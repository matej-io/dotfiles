import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  readdirSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { spawnSync, spawn, execFileSync } from "node:child_process";
import { once } from "node:events";

import { fileURLToPath } from "node:url";
const script = fileURLToPath(
  new URL("../with-testflight-secrets.mjs", import.meta.url),
);
const privateKey = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
}).privateKey;

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "hilma-secrets-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const marker = join(dir, "result.json");
  execFileSync("git", ["init", "--quiet", dir]);
  mkdirSync(join(dir, "config"));
  const config = JSON.parse(
    readFileSync(new URL("./fixtures/hilma.json", import.meta.url)),
  );
  config.tokenFile = join(dir, "token");
  writeFileSync(join(dir, "config/testflight.json"), JSON.stringify(config));
  writeFileSync(
    join(dir, config.secretsFile),
    JSON.stringify(
      Object.fromEntries(
        ["keyId", "issuerId", "privateKey"].map((key, i) => [
          key,
          "op://hilma-platform-dev/testflight/" +
            ["key-id", "issuer-id", "private-key"][i],
        ]),
      ),
    ),
  );
  writeFileSync(join(dir, "token"), "test-service-account-token\n", {
    mode: 0o600,
  });
  writeFileSync(
    join(dir, "op"),
    `#!${process.execPath}
if (process.env.OP_SERVICE_ACCOUNT_TOKEN !== 'test-service-account-token') process.exit(9);
if (process.env.FAIL_OP) { console.error('sensitive-error-content'); process.exit(1); }
if (!process.argv[3].startsWith('op://hilma-platform-dev/testflight/')) process.exit(10);
const field = process.argv[3].split('/').pop();
const values = { 'key-id': 'ABCDEFGHIJ', 'issuer-id': '12345678-1234-1234-1234-123456789abc', 'private-key': process.env.TEST_PRIVATE_KEY };
process.stdout.write(values[field]);
`,
    { mode: 0o700 },
  );
  const env = {
    ...process.env,
    PATH: `${dir}:${process.env.PATH}`,
    TEST_PRIVATE_KEY: privateKey,
    MARKER: marker,
  };
  delete env.OP_SERVICE_ACCOUNT_TOKEN;

  const invoke = (args, overrides = {}) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: dir,
      env: { ...env, ...overrides },
      encoding: "utf8",
      timeout: 10000,
    });
  return { dir, marker, invoke, env };
}

test("loads token from file and validates credentials without printing them", (t) => {
  const { invoke } = fixture(t);
  const result = invoke(["--check"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /format validated/);
  assert.ok(!result.stdout.includes("PRIVATE KEY"));
  assert.equal(result.stderr, "");
});

test("restricts key permissions, strips OP token, preserves arguments/exit status and cleans up", (t) => {
  const { marker, invoke } = fixture(t);
  const result = invoke(
    [
      "--",
      process.execPath,
      "-e",
      `
    const fs = require('node:fs');
    fs.writeFileSync(process.env.MARKER, JSON.stringify({
      path: process.env.ASC_KEY_PATH,
      mode: fs.statSync(process.env.ASC_KEY_PATH).mode & 0o777,
      directoryMode: fs.statSync(require('node:path').dirname(process.env.ASC_KEY_PATH)).mode & 0o777,
      keyMatches: fs.readFileSync(process.env.ASC_KEY_PATH, 'utf8') === process.env.TEST_PRIVATE_KEY,
      tokenPresent: Boolean(process.env.OP_SERVICE_ACCOUNT_TOKEN),
      keyId: process.env.ASC_KEY_ID, argument: process.argv[1]
    })); process.exit(7);
  `,
      "literal $(do-not-run) argument",
    ],
    { OP_SERVICE_ACCOUNT_TOKEN: "test-service-account-token" },
  );
  assert.equal(result.status, 7, result.stderr);
  const data = JSON.parse(readFileSync(marker, "utf8"));
  assert.equal(data.mode, 0o600);
  assert.equal(data.directoryMode, 0o700);
  assert.equal(data.keyMatches, true);
  assert.equal(data.tokenPresent, false);
  assert.equal(data.keyId, "ABCDEFGHIJ");
  assert.equal(data.argument, "literal $(do-not-run) argument");
  assert.equal(existsSync(data.path), false);
});

test("redacts op failures and does not run the release command", (t) => {
  const { marker, invoke } = fixture(t);
  const result = invoke(
    [
      "--",
      process.execPath,
      "-e",
      `require('node:fs').writeFileSync(process.env.MARKER, 'bad')`,
    ],
    {
      FAIL_OP: "1",
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot load TestFlight/);
  assert.ok(!result.stderr.includes("sensitive-error-content"));
  assert.equal(existsSync(marker), false);
});

test("rejects malformed private keys without disclosing their contents", (t) => {
  const { invoke } = fixture(t);
  const result = invoke(["--check"], {
    TEST_PRIVATE_KEY: "secret-invalid-key",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid App Store Connect private key/);
  assert.ok(!result.stderr.includes("secret-invalid-key"));
});

test("fails clearly when the token is unavailable", (t) => {
  const { dir, invoke } = fixture(t);
  rmSync(join(dir, "token"));
  const result = invoke(["--check"]);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Cannot read the configured 1Password token file/,
  );
});

test("supplies Xcode authentication arguments and cleans up the key", (t) => {
  const { dir, marker, invoke } = fixture(t);
  writeFileSync(
    join(dir, "xcodebuild"),
    `#!${process.execPath}
require('node:fs').writeFileSync(process.env.MARKER, JSON.stringify(process.argv.slice(2)));
`,
    { mode: 0o700 },
  );
  const result = invoke(["--xcodebuild", "-scheme", "Hilma", "archive"]);
  assert.equal(result.status, 0, result.stderr);
  const args = JSON.parse(readFileSync(marker, "utf8"));
  assert.deepEqual(args.slice(0, 3), ["-scheme", "Hilma", "archive"]);
  assert.ok(!args.includes("-allowProvisioningUpdates"));
  assert.equal(args[args.indexOf("-authenticationKeyID") + 1], "ABCDEFGHIJ");
  assert.equal(
    existsSync(args[args.indexOf("-authenticationKeyPath") + 1]),
    false,
  );
});

test(
  "forwards termination and removes the temporary key",
  { timeout: 10000 },
  async (t) => {
    const { dir, env } = fixture(t);
    const child = spawn(
      process.execPath,
      [
        script,
        "--",
        process.execPath,
        "-e",
        `
    console.log(process.env.ASC_KEY_PATH);
    setInterval(() => {}, 1000);
  `,
      ],
      { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] },
    );
    t.after(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    });
    const closed = once(child, "close");
    const [output] = await once(child.stdout, "data");
    const path = output.toString().trim();
    assert.equal(existsSync(path), true);
    child.kill("SIGTERM");
    const [code] = await closed;
    assert.equal(code, 143);
    assert.equal(existsSync(path), false);
  },
);

test("an explicit environment token overrides the configured missing file", (t) => {
  const { dir, invoke } = fixture(t);
  rmSync(join(dir, "token"));
  const result = invoke(["--check"], {
    OP_SERVICE_ACCOUNT_TOKEN: "test-service-account-token",
  });
  assert.equal(result.status, 0, result.stderr);
});

test("rejects raw secret configuration without printing it", (t) => {
  const { dir, invoke } = fixture(t);
  const config = join(dir, "config/testflight.secrets.json");
  writeFileSync(config, JSON.stringify({ keyId: "sensitive-raw-value" }));
  const result = invoke(["--check"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be an op:\/\/ secret reference/);
  assert.ok(!result.stderr.includes("sensitive-raw-value"));
});

test("cleans up temporary keys when the child cannot start", (t) => {
  const { dir, invoke } = fixture(t);
  const result = invoke(["--", join(dir, "missing-command")], { TMPDIR: dir });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Could not start/);
  assert.equal(
    readdirSync(dir).some((name) => name.startsWith("testflight-")),
    false,
  );
});
