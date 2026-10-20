import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateConfig } from "../config.mjs";
import {
  appSettings,
  tagName,
  verifyAppInfo,
  verifyEntitlements,
  preflight,
  verifyArchiveExtras,
} from "../testflight-release.mjs";
import { latestTag } from "../testflight-whats-new.mjs";
import { client } from "../testflight.mjs";

for (const name of ["hilma", "isum", "calorie"]) {
  const c = JSON.parse(
    readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)),
  );
  test(`${name}: identity, configuration, archive and tag conventions`, () => {
    assert.equal(validateConfig(c), c);
    const entry = {
      target: c.target,
      buildSettings: {
        PRODUCT_BUNDLE_IDENTIFIER: c.bundleId,
        DEVELOPMENT_TEAM: c.teamId,
        MARKETING_VERSION: "2.1.0",
        CURRENT_PROJECT_VERSION: "42",
      },
    };
    assert.deepEqual(appSettings([entry], c), {
      version: "2.1.0",
      localBuild: "42",
    });
    assert.throws(
      () => appSettings([entry], { ...c, bundleId: "wrong.bundle" }),
      /bundle ID/,
    );
    verifyAppInfo(
      {
        CFBundleIdentifier: c.bundleId,
        CFBundleShortVersionString: "2.1.0",
        CFBundleVersion: "43",
      },
      { version: "2.1.0", build: "43" },
      c,
    );
    const tag = tagName("2.1.0", "43", c.tagPrefix);
    assert.equal(tag, c.tagPrefix + "2.1.0-43");
    assert.equal(
      latestTag(
        [tag, "testflight/other-2.1.0-99", c.tagPrefix + "2.0.0-42"],
        c.tagPrefix,
      ),
      tag,
    );
  });
}

test("invalid project policy fails before any release action", () => {
  const c = JSON.parse(
    readFileSync(new URL("./fixtures/hilma.json", import.meta.url)),
  );
  for (const change of [
    { schemaVersion: 2 },
    { project: "other.xcodeproj" },
    { workspace: undefined },
    { appDir: "../other" },
    { secretsFile: "/secret" },
    { teamId: "wrong" },
    { preflight: [{ command: "sh", args: "echo x", cwd: "." }] },
    { artifactDir: "." },
  ]) {
    assert.throws(() => validateConfig({ ...c, ...change }));
  }
});

test("Pods, required resources and signed entitlements remain mandatory", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "testflight-policy-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "Pods"));
  writeFileSync(join(dir, "Podfile.lock"), "expected");
  writeFileSync(join(dir, "Pods/Manifest.lock"), "stale");
  await assert.rejects(preflight({ podsDir: "." }, dir, dir), /does not match/);
  writeFileSync(join(dir, "Pods/Manifest.lock"), "expected");
  await preflight({ podsDir: "." }, dir, dir);
  await assert.rejects(
    preflight({ requiredFiles: ["missing.db"] }, dir, dir),
    /Required release file/,
  );
  assert.throws(
    () => verifyArchiveExtras({ archiveFiles: ["missing.db"] }, dir),
    /Archive is missing/,
  );
  const expected = {
    "com.apple.developer.ubiquity-kvstore-identifier": "TEAM.app",
  };
  verifyEntitlements(expected, expected);
  assert.throws(() => verifyEntitlements({}, expected), /Signed entitlement/);
});

test("API token provider is refreshed for each request and retry", async () => {
  let number = 0;
  const headers = [];
  const api = client(
    () => `token-${++number}`,
    async (url, options) => {
      headers.push(options.headers.Authorization);
      return {
        ok: number > 1,
        status: number === 1 ? 503 : 200,
        json: async () => ({ data: [] }),
      };
    },
    { sleep: async () => {}, log: () => {} },
  );
  await api.get("/v1/builds");
  await api.get("/v1/apps");
  assert.deepEqual(headers, [
    "Bearer token-1",
    "Bearer token-2",
    "Bearer token-3",
  ]);
});
