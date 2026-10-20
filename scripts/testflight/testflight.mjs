#!/usr/bin/env node
// Read-only App Store Connect operations. Upload is a separate Xcode command.
import { readFileSync } from "node:fs";
import { sign } from "node:crypto";
import { pathToFileURL } from "node:url";

import { loadConfig } from "./config.mjs";
const ORIGIN = "https://api.appstoreconnect.apple.com";

export function token(env = process.env, now = Math.floor(Date.now() / 1000)) {
  if (!env.ASC_KEY_ID || !env.ASC_ISSUER_ID || !env.ASC_KEY_PATH) {
    throw new Error("Run this command through testflight.");
  }
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const message = `${encode({ alg: "ES256", kid: env.ASC_KEY_ID, typ: "JWT" })}.${encode(
    {
      iss: env.ASC_ISSUER_ID,
      iat: now,
      exp: now + 600,
      aud: "appstoreconnect-v1",
    },
  )}`;
  try {
    return `${message}.${sign("sha256", Buffer.from(message), {
      key: readFileSync(env.ASC_KEY_PATH),
      dsaEncoding: "ieee-p1363",
    }).toString("base64url")}`;
  } catch {
    throw new Error(
      "Cannot sign App Store Connect request. Check the temporary API key.",
    );
  }
}

// Apple's API returns intermittent 5xx errors; reads are safe to repeat.
const ATTEMPTS = 6;
const delay = (attempt) =>
  Math.min(1000 * 2 ** (attempt - 1), 16000) + Math.floor(Math.random() * 500);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Apple error codes are short constants such as UNEXPECTED_ERROR; never relay free-form detail.
async function errorCode(response) {
  try {
    const code = (await response.json())?.errors?.[0]?.code;
    return /^[A-Z][A-Z0-9_.]{0,80}$/.test(code ?? "") ? ` (${code})` : "";
  } catch {
    return "";
  }
}

export function client(
  jwt,
  fetcher = fetch,
  { sleep = wait, log = console.error } = {},
) {
  const get = async (path) => {
    const url = new URL(path, ORIGIN);
    // Never send the bearer token to a pagination URL outside Apple's API.
    if (
      url.origin !== ORIGIN ||
      !url.pathname.startsWith("/v1/") ||
      url.username ||
      url.password
    ) {
      throw new Error("Unexpected App Store Connect URL.");
    }
    let response;
    for (let attempt = 1; ; attempt++) {
      let problem;
      try {
        response = await fetcher(url, {
          headers: {
            Authorization: `Bearer ${typeof jwt === "function" ? jwt() : jwt}`,
          },
          redirect: "error",
          signal: AbortSignal.timeout(30000),
        });
      } catch {
        problem = "request failed or timed out";
      }
      if (response && !problem) {
        if (response.ok) break;
        const code = await errorCode(response);
        if (response.status !== 429 && response.status < 500) {
          throw new Error(
            `App Store Connect HTTP ${response.status}${code}; check API key access and the request.`,
          );
        }
        problem = `HTTP ${response.status}${code}`;
      }
      if (attempt === ATTEMPTS) {
        throw new Error(
          `App Store Connect ${problem} after ${ATTEMPTS} attempts; Apple may be unavailable or rate limiting. Try again later; no changes were made.`,
        );
      }
      const ms = delay(attempt);
      log(
        `  App Store Connect ${problem}; retrying in ${Math.round(ms / 1000)}s (attempt ${attempt + 1}/${ATTEMPTS})`,
      );
      await sleep(ms);
    }
    try {
      return await response.json();
    } catch {
      throw new Error("Invalid App Store Connect response.");
    }
  };
  const all = async (path) => {
    const result = [];
    const visited = new Set();
    while (path) {
      if (visited.has(path) || visited.size >= 1000)
        throw new Error("App Store Connect pagination did not complete.");
      visited.add(path);
      const page = await get(path);
      if (!Array.isArray(page.data))
        throw new Error("Expected an App Store Connect collection.");
      result.push(...page.data);
      path = page.links?.next;
    }
    return result;
  };
  return { get, all };
}

export function nextBuild(local, builds) {
  // An integer above the largest first component also exceeds dotted builds.
  const values = [local, ...builds.map((build) => build.attributes.version)];
  const first = values.map((value) => {
    if (!/^[1-9]\d{0,3}(?:\.\d{1,2}){0,2}$/.test(String(value))) {
      throw new Error(
        "Nonstandard build number encountered; reconcile build numbering before release.",
      );
    }
    return Number(String(value).split(".")[0]);
  });
  const candidate = Math.max(...first) + 1;
  if (candidate > 9999)
    throw new Error(
      "Integer build-number range exhausted; choose a reviewed dotted numbering strategy.",
    );
  return String(candidate);
}

// Build numbers only grow, so the newest processed build holds the highest one.
// Uploads include builds still processing or never processed, which also hold their numbers;
// buildUploads ignores sort=-uploadedDate, so it is read in full.
export async function buildHistory(api, appId) {
  const latest = new URLSearchParams({
    "filter[app]": appId,
    sort: "-uploadedDate",
    "fields[builds]": "version",
    limit: "1",
  });
  const [builds, uploads] = await Promise.all([
    api.get(`/v1/builds?${latest}`),
    api.all(`/v1/apps/${encodeURIComponent(appId)}/buildUploads?limit=200`),
  ]);
  if (!Array.isArray(builds.data))
    throw new Error("Expected an App Store Connect collection.");
  return [
    ...builds.data.map((build) => build.attributes.version),
    ...uploads.map((upload) => upload.attributes.cfBundleVersion),
  ].map((version) => ({ attributes: { version } }));
}

export async function app(api, bundleId) {
  const apps = await api.all(
    `/v1/apps?${new URLSearchParams({ "filter[bundleId]": bundleId, limit: "200" })}`,
  );
  if (apps.length !== 1 || apps[0].attributes.bundleId !== bundleId) {
    throw new Error(
      "Expected exactly one accessible app with the configured bundle ID.",
    );
  }
  return apps[0];
}

export async function status(api, appId, version, buildNumber) {
  const query = new URLSearchParams({
    "filter[app]": appId,
    "filter[version]": buildNumber,
    limit: "200",
  });
  const builds = await api.all(`/v1/builds?${query}`);
  const matches = [];
  for (const build of builds) {
    const release = await api.get(
      `/v1/builds/${encodeURIComponent(build.id)}/preReleaseVersion`,
    );
    if (
      release.data.attributes.platform === "IOS" &&
      release.data.attributes.version === version
    )
      matches.push(build);
  }
  if (matches.length > 1)
    throw new Error(
      "Multiple matching builds; inspect App Store Connect before proceeding.",
    );
  if (!matches.length) return { state: "NOT_FOUND", ready: false };
  const build = matches[0];
  const state = build.attributes.processingState;
  const result = {
    buildId: build.id,
    state,
    expired: build.attributes.expired,
    ready: false,
  };
  if (state !== "VALID" || build.attributes.expired) return result;
  const detail = await api.get(
    `/v1/builds/${encodeURIComponent(build.id)}/buildBetaDetail`,
  );
  // Apple permits only one relationship filter here. The exact build already
  // belongs to the app verified above, so an additional app filter is redundant.
  const groups = await api.all(
    `/v1/betaGroups?${new URLSearchParams({ "filter[builds]": build.id, limit: "200" })}`,
  );
  return {
    ...result,
    internalState: detail.data.attributes.internalBuildState,
    externalState: detail.data.attributes.externalBuildState,
    groups: groups.map((group) => ({
      id: group.id,
      name: group.attributes.name,
      internal: group.attributes.isInternalGroup,
    })),
    // API eligibility is not proof of tester membership or installation.
    ready:
      detail.data.attributes.internalBuildState === "IN_BETA_TESTING" &&
      groups.some((group) => group.attributes.isInternalGroup === true),
  };
}

const usage = `Usage:
  testflight next-build <current-project-build>
  testflight status <marketing-version> <build-number>
All Apple requests are read-only. next-build prints a candidate, not a reservation.
status exits 0 for internal group availability, 2 for pending/not available, 1 for errors.`;

export async function main(args) {
  if (args.length === 1 && args[0] === "--help") {
    console.log(usage);
    return 0;
  }
  if (
    !(
      (args[0] === "next-build" && args.length === 2) ||
      (args[0] === "status" &&
        args.length === 3 &&
        /^\d+(?:\.\d+){1,2}$/.test(args[1]) &&
        /^\d+(?:\.\d+){0,2}$/.test(args[2]))
    )
  ) {
    throw new Error(usage);
  }
  const { bundleId } = loadConfig();
  const api = client(token);
  const target = await app(api, bundleId);
  if (args[0] === "next-build") {
    console.log(nextBuild(args[1], await buildHistory(api, target.id)));
    return 0;
  }
  const result = await status(api, target.id, args[1], args[2]);
  console.log(
    JSON.stringify(
      {
        appId: target.id,
        bundleId,
        version: args[1],
        build: args[2],
        ...result,
      },
      null,
      2,
    ),
  );
  return result.ready ? 0 : 2;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
