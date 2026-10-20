import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHistory, nextBuild } from "../testflight.mjs";
import {
  compareVersions,
  appSettings,
  parseArgs,
  signingIdentities,
  tagName,
  verifyAppInfo,
} from "../testflight-release.mjs";
import { readFileSync } from "node:fs";
const config = JSON.parse(
  readFileSync(new URL("./fixtures/hilma.json", import.meta.url)),
);
const BUNDLE_ID = config.bundleId;
const TEAM_ID = config.teamId;
import { latestTag } from "../testflight-whats-new.mjs";

test("options default to origin/main with upload, tag, and wait", () => {
  assert.deepEqual(parseArgs([]), {
    ref: "origin/main",
    version: null,
    dryRun: false,
    provisioning: false,
    wait: true,
  });
  assert.deepEqual(
    parseArgs([
      "--ref",
      "abc123",
      "--version",
      "2.1.0",
      "--dry-run",
      "--no-wait",
    ]),
    {
      ref: "abc123",
      version: "2.1.0",
      dryRun: true,
      provisioning: false,
      wait: false,
    },
  );
  assert.equal(parseArgs(["--allow-provisioning-updates"]).provisioning, true);
  assert.throws(() => parseArgs(["--ref"]), /needs a value/);
  assert.throws(() => parseArgs(["--version", "two"]), /must look like/);
  assert.throws(() => parseArgs(["--upload"]), /Unknown option/);
});

test("tags name the marketing version and build number", () => {
  assert.equal(tagName("2.1.0", "93"), "testflight/2.1.0-93");
  assert.throws(() => tagName("2.1.0", "93; rm"), /Invalid/);
  assert.throws(() => tagName("main", "93"), /Invalid/);
});

test("versions compare numerically", () => {
  assert.equal(compareVersions("2.0.1", "2.1.0"), -1);
  assert.equal(compareVersions("2.10", "2.9.9"), 1);
  assert.equal(compareVersions("2.1", "2.1.0"), 0);
});

test("build settings must be the Hilma app target with the expected identity", () => {
  const entry = (overrides = {}) => ({
    target: "Hilma",
    buildSettings: {
      PRODUCT_BUNDLE_IDENTIFIER: BUNDLE_ID,
      DEVELOPMENT_TEAM: TEAM_ID,
      MARKETING_VERSION: "2.0.1",
      CURRENT_PROJECT_VERSION: "88",
      ...overrides,
    },
  });
  const pods = { target: "Pods-Hilma", buildSettings: {} };
  assert.deepEqual(appSettings([pods, entry()], config), {
    version: "2.0.1",
    localBuild: "88",
  });
  assert.throws(() => appSettings([pods], config), /exactly one/);
  assert.throws(
    () => appSettings([entry({ PRODUCT_BUNDLE_IDENTIFIER: "other" })], config),
    /bundle ID/,
  );
  assert.throws(
    () => appSettings([entry({ DEVELOPMENT_TEAM: "OTHER" })], config),
    /team/,
  );
  assert.throws(
    () => appSettings([entry({ CURRENT_PROJECT_VERSION: "1.2" })], config),
    /integer/,
  );
});

test("archive metadata must match the allocation exactly", () => {
  const info = {
    CFBundleIdentifier: BUNDLE_ID,
    CFBundleShortVersionString: "2.1.0",
    CFBundleVersion: "93",
  };
  verifyAppInfo(info, { version: "2.1.0", build: "93" }, config);
  assert.throws(
    () => verifyAppInfo(info, { version: "2.1.0", build: "94" }, config),
    /CFBundleVersion/,
  );
  assert.throws(
    () =>
      verifyAppInfo(
        { ...info, CFBundleIdentifier: "x" },
        { version: "2.1.0", build: "93" },
        config,
      ),
    /Identifier/,
  );
});

test("allocation counts uploads that never became builds", async () => {
  const pages = {
    builds: [{ attributes: { version: "92" } }],
    buildUploads: [
      { attributes: { cfBundleVersion: "93" } },
      { attributes: { cfBundleVersion: "73" } },
    ],
  };
  const requested = [];
  const api = {
    get: async (path) => {
      requested.push(path);
      return { data: pages.builds };
    },
    all: async (path) =>
      path.includes("/buildUploads") ? pages.buildUploads : assert.fail(path),
  };
  assert.equal(nextBuild("88", await buildHistory(api, "app")), "94");
  const query = new URL(requested[0], "https://api.appstoreconnect.apple.com")
    .searchParams;
  assert.equal(query.get("filter[app]"), "app");
  assert.equal(query.get("sort"), "-uploadedDate");
  assert.equal(query.get("limit"), "1");
});

test("whats-new picks the highest build number across versions", () => {
  assert.equal(
    latestTag([
      "testflight/2.1.0-92",
      "testflight/2.0.1-93",
      "testflight/2.1.0-100",
      "testflight/bad",
    ]),
    "testflight/2.1.0-100",
  );
  assert.equal(latestTag([]), undefined);
});

test("signing probe covers Apple Development and Distribution identities only", () => {
  const a = "A".repeat(40);
  const b = "B".repeat(40);
  const output = `  1) ${a} "Apple Development: Someone (ABCDE12345)"
  2) ${b} "Apple Distribution: Hilma (43KYYF2RZM)"
  3) ${"C".repeat(40)} "Developer ID Application: Other"
     3 valid identities found`;
  assert.deepEqual(signingIdentities(output), [a, b]);
});
