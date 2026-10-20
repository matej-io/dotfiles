import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { client, nextBuild, token, status, app } from "../testflight.mjs";

const BUNDLE_ID = "com.example.app";
const build = (version, extra = {}) => ({
  id: version,
  attributes: { version, ...extra },
});
test("allocation includes local floor, unsorted historical pages, and dotted builds", () => {
  assert.equal(nextBuild("88", []), "89");
  assert.equal(
    nextBuild("88", [build("100"), build("9"), build("99.12.3")]),
    "101",
  );
  assert.throws(
    () => nextBuild("88", [build("secret-bad-value")]),
    /Nonstandard/,
  );
  assert.throws(() => nextBuild("9999", []), /exhausted/);
});

test("pagination is complete and bearer tokens cannot follow foreign URLs or redirects", async () => {
  const urls = [];
  const api = client("test-token", async (url, options) => {
    urls.push(url.toString());
    assert.equal(options.redirect, "error");
    return {
      ok: true,
      json: async () => ({
        data: [build(String(urls.length))],
        links: {
          next:
            urls.length === 1
              ? "https://api.appstoreconnect.apple.com/v1/builds?cursor=next"
              : null,
        },
      }),
    };
  });
  assert.equal((await api.all("/v1/builds")).length, 2);
  await assert.rejects(api.get("https://evil.example/v1/builds"), /Unexpected/);
  assert.equal(urls.length, 2);
});

test("API errors are sanitized and never produce an allocation from partial pages", async () => {
  const api = client("test-token", async () => ({
    ok: false,
    status: 403,
    json: async () => {
      throw new Error("sensitive content");
    },
  }));
  await assert.rejects(
    api.all("/v1/builds"),
    /^Error: App Store Connect HTTP 403;/,
  );
  // Client errors fail immediately rather than retrying.
  const looping = client("test-token", async () => ({
    ok: true,
    json: async () => ({ data: [], links: { next: "/v1/builds" } }),
  }));
  await assert.rejects(looping.all("/v1/builds"), /pagination/);
});

test("server errors, rate limits, and network failures are retried with backoff", async () => {
  const failures = [
    {
      ok: false,
      status: 500,
      json: async () => ({
        errors: [{ code: "UNEXPECTED_ERROR", detail: "secret detail" }],
      }),
    },
    { ok: false, status: 429, json: async () => ({}) },
    new Error("socket hang up"),
  ];
  const logs = [];
  const sleeps = [];
  const api = client(
    "test-token",
    async () => {
      const next = failures.shift();
      if (next instanceof Error) throw next;
      return next ?? { ok: true, json: async () => ({ data: [build("96")] }) };
    },
    { sleep: async (ms) => sleeps.push(ms), log: (line) => logs.push(line) },
  );
  assert.equal((await api.get("/v1/builds")).data[0].attributes.version, "96");
  assert.equal(sleeps.length, 3);
  assert.ok(sleeps[0] < sleeps[1] && sleeps[1] < sleeps[2]);
  assert.match(logs[0], /HTTP 500 \(UNEXPECTED_ERROR\); retrying/);
  assert.ok(!logs.join("\n").includes("secret detail"));

  let calls = 0;
  const down = client(
    "test-token",
    async () => {
      calls++;
      return { ok: false, status: 503, json: async () => ({}) };
    },
    { sleep: async () => {}, log: () => {} },
  );
  await assert.rejects(down.get("/v1/builds"), /HTTP 503 after 6 attempts/);
  assert.equal(calls, 6);
});

test("JWT has a ten-minute lifetime and a valid Apple-compatible ES256 signature", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "hilma-jwt-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const path = join(dir, "key.p8");
  writeFileSync(path, privateKey.export({ type: "pkcs8", format: "pem" }), {
    mode: 0o600,
  });
  const jwt = token(
    { ASC_KEY_ID: "ABCDEFGHIJ", ASC_ISSUER_ID: "issuer", ASC_KEY_PATH: path },
    1000,
  );
  const [header, payload, signature] = jwt.split(".");
  assert.equal(JSON.parse(Buffer.from(header, "base64url")).alg, "ES256");
  assert.deepEqual(JSON.parse(Buffer.from(payload, "base64url")), {
    iss: "issuer",
    iat: 1000,
    exp: 1600,
    aud: "appstoreconnect-v1",
  });
  assert.equal(
    verify(
      "sha256",
      Buffer.from(`${header}.${payload}`),
      {
        key: publicKey,
        dsaEncoding: "ieee-p1363",
      },
      Buffer.from(signature, "base64url"),
    ),
    true,
  );
});

function statusAPI({
  state = "VALID",
  expired = false,
  version = "2.0.1",
  internal = "IN_BETA_TESTING",
  groups = true,
} = {}) {
  return {
    all: async (path) => {
      const url = new URL(path, "https://api.appstoreconnect.apple.com");
      if (url.pathname === "/v1/builds") {
        assert.equal(url.searchParams.get("filter[app]"), "app");
        assert.equal(url.searchParams.get("filter[version]"), "89");
        return [build("89", { processingState: state, expired })];
      }
      assert.equal(url.pathname, "/v1/betaGroups");
      // Apple rejects app + builds with HTTP 400: only one relationship filter is allowed.
      assert.equal(url.searchParams.has("filter[app]"), false);
      assert.equal(url.searchParams.get("filter[builds]"), "89");
      return groups
        ? [
            {
              id: "group",
              attributes: { name: "Internal", isInternalGroup: true },
            },
          ]
        : [];
    },
    get: async (path) => ({
      data: {
        attributes: path.endsWith("/preReleaseVersion")
          ? { version, platform: "IOS" }
          : {
              internalBuildState: internal,
              externalBuildState: "READY_FOR_BETA_SUBMISSION",
            },
      },
    }),
  };
}
test("availability requires exact marketing version, valid nonexpired build and internal testing group", async () => {
  assert.equal((await status(statusAPI(), "app", "2.0.1", "89")).ready, true);
  for (const settings of [
    { state: "PROCESSING" },
    { state: "FAILED" },
    { expired: true },
    { version: "2.0.0" },
    { internal: "MISSING_EXPORT_COMPLIANCE" },
    { groups: false },
  ]) {
    assert.equal(
      (await status(statusAPI(settings), "app", "2.0.1", "89")).ready,
      false,
    );
  }
});

test("app lookup fails closed on missing, ambiguous, or wrong bundle", async () => {
  for (const data of [[], [{ attributes: { bundleId: "wrong" } }], [{}, {}]]) {
    await assert.rejects(
      app({ all: async () => data }, BUNDLE_ID),
      /exactly one/,
    );
  }
  assert.equal(
    (
      await app(
        {
          all: async () => [
            { id: "correct", attributes: { bundleId: BUNDLE_ID } },
          ],
        },
        BUNDLE_ID,
      )
    ).id,
    "correct",
  );
});
