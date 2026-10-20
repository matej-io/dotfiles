#!/usr/bin/env node
// Archive the configured iOS app from a clean worktree, upload it to TestFlight, and tag the released commit.
// Run through with-testflight-secrets (`testflight release`) so Apple credentials are available.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  app,
  buildHistory,
  client,
  nextBuild,
  status,
  token,
} from "./testflight.mjs";

import { loadConfig } from "./config.mjs";
const WAIT_INTERVAL_MS = 30_000;
const WAIT_LIMIT_MS = 30 * 60_000;

const usage = `Usage: testflight release [options]

Builds the iOS app from a clean checkout, uploads it to TestFlight, and tags the
commit as <configured-prefix><version>-<build>. The build number is the highest number
App Store Connect has seen plus one.

Options:
  --ref <git-ref>                 Commit to release (default: origin/main). Must be pushed.
  --version <x.y.z>               Marketing version (default: the project's MARKETING_VERSION).
  --dry-run                       Archive and export an IPA locally; no upload and no tag.
  --allow-provisioning-updates    Let Xcode create or update signing assets.
  --no-wait                       Do not wait for App Store Connect processing after upload.
  --help                          Show this help.`;

export function parseArgs(args) {
  const options = {
    ref: "origin/main",
    version: null,
    dryRun: false,
    provisioning: false,
    wait: true,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help") return { help: true };
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--allow-provisioning-updates")
      options.provisioning = true;
    else if (arg === "--no-wait") options.wait = false;
    else if (arg === "--ref" || arg === "--version") {
      const value = args[++i];
      if (!value || value.startsWith("--"))
        throw new Error(`${arg} needs a value.\n\n${usage}`);
      options[arg.slice(2)] = value;
    } else throw new Error(`Unknown option ${arg}.\n\n${usage}`);
  }
  if (
    options.version !== null &&
    !/^\d+\.\d+(?:\.\d+)?$/.test(options.version)
  ) {
    throw new Error("--version must look like 2.1.0.");
  }
  return options;
}

export function tagName(version, build, prefix = "testflight/") {
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(version) || !/^\d+$/.test(build))
    throw new Error("Invalid version or build for tag.");
  return `${prefix}${version}-${build}`;
}

export function compareVersions(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff) return Math.sign(diff);
  }
  return 0;
}

// Picks the configured app target from `xcodebuild -showBuildSettings -json`, ignoring Pods targets.
export function appSettings(entries, config) {
  const matches = entries.filter((entry) => entry.target === config.target);
  if (matches.length !== 1)
    throw new Error(
      `Expected exactly one ${config.target} target in build settings.`,
    );
  const settings = matches[0].buildSettings;
  if (settings.PRODUCT_BUNDLE_IDENTIFIER !== config.bundleId) {
    throw new Error(
      `Unexpected bundle ID ${settings.PRODUCT_BUNDLE_IDENTIFIER}; expected ${config.bundleId}.`,
    );
  }
  if (settings.DEVELOPMENT_TEAM !== config.teamId) {
    throw new Error(
      `Unexpected team ${settings.DEVELOPMENT_TEAM}; expected ${config.teamId}.`,
    );
  }
  if (!/^\d+$/.test(settings.CURRENT_PROJECT_VERSION ?? ""))
    throw new Error("Project build number is not an integer.");
  return {
    version: settings.MARKETING_VERSION,
    localBuild: settings.CURRENT_PROJECT_VERSION,
  };
}

// Archive and IPA metadata must match exactly what was allocated.
export function verifyAppInfo(info, { version, build }, config) {
  const expected = {
    CFBundleIdentifier: config.bundleId,
    CFBundleShortVersionString: version,
    CFBundleVersion: build,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (info[key] !== value)
      throw new Error(`Archive ${key} is ${info[key]}; expected ${value}.`);
  }
}

const log = (message) => console.log(`\n▸ ${message}`);

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function plistValue(file, key) {
  try {
    return execFileSync("plutil", ["-extract", key, "raw", "-o", "-", file], {
      encoding: "utf8",
    }).trim();
  } catch {
    return undefined;
  }
}

function authArgs() {
  return [
    "-authenticationKeyPath",
    process.env.ASC_KEY_PATH,
    "-authenticationKeyID",
    process.env.ASC_KEY_ID,
    "-authenticationKeyIssuerID",
    process.env.ASC_ISSUER_ID,
  ];
}

// Full xcodebuild output goes to a log file; the terminal gets only results and errors.
function runLogged(command, args, { cwd, logFile }) {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(logFile);
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let pending = "";
    const onData = (chunk) => {
      out.write(chunk);
      pending += chunk.toString();
      const lines = pending.split("\n");
      pending = lines.pop();
      for (const line of lines) {
        if (/^\*\* .* \*\*$|(^|: )error: |^Uploaded |^Exported /.test(line))
          console.log(`  ${line}`);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const forward = (signal) => child.kill(signal);
    const signals = ["SIGINT", "SIGTERM", "SIGHUP"];
    for (const signal of signals) process.on(signal, forward);
    child.on("error", () => reject(new Error(`Could not start ${command}.`)));
    child.on("close", (code) => {
      for (const signal of signals) process.removeListener(signal, forward);
      out.end();
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${command} failed (exit ${code ?? "signal"}); see ${logFile}`,
          ),
        );
    });
  });
}

const xcodebuild = (args, options) => runLogged("xcodebuild", args, options);

// codesign blocks forever when the Keychain wants to show an access prompt that no one can
// see (headless or SSH sessions), so probe each identity with a timeout before archiving.
export function signingIdentities(output) {
  return [
    ...output.matchAll(
      /^\s*\d+\) ([0-9A-F]{40}) "Apple (?:Development|Distribution):/gm,
    ),
  ].map((match) => match[1]);
}

function checkSigning(root, provisioning) {
  const output = execFileSync(
    "security",
    ["find-identity", "-v", "-p", "codesigning"],
    { encoding: "utf8" },
  );
  const identities = signingIdentities(output);
  if (!identities.length)
    throw new Error(
      "No Apple Development or Distribution signing identity in the Keychain.",
    );
  // Without provisioning updates, the App Store export needs a local distribution key.
  if (!provisioning && !/"(Apple|iPhone) Distribution: /.test(output)) {
    throw new Error(`No Apple Distribution certificate with a private key in the Keychain, so the App Store export would fail.
Either import the team's distribution certificate (.p12) into this Mac's login Keychain, or rerun with
--allow-provisioning-updates so Xcode uses cloud-managed signing through the App Store Connect API key.`);
  }
  const probe = join(root, "signing-probe");
  for (const identity of identities) {
    copyFileSync("/usr/bin/true", probe);
    const result = spawnSync(
      "codesign",
      ["--force", "--sign", identity, probe],
      { stdio: "ignore", timeout: 30_000 },
    );
    if (result.error?.code === "ETIMEDOUT") {
      throw new Error(`codesign is waiting for a Keychain permission prompt that this session cannot show.
Allow codesign to use the signing key once, then rerun. Either:
  - in a desktop session on this Mac, sign anything and choose "Always Allow", or
  - run: security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k '<login password>' ~/Library/Keychains/login.keychain-db`);
    }
  }
  rmSync(probe, { force: true });
}

export async function preflight(config, source, root) {
  for (const file of config.requiredFiles ?? []) {
    if (!existsSync(join(source, file)))
      throw new Error(`Required release file is missing: ${file}`);
  }
  if (config.podsDir) {
    const lock = join(source, config.podsDir, "Podfile.lock");
    const manifest = join(source, config.podsDir, "Pods/Manifest.lock");
    if (
      !existsSync(lock) ||
      !existsSync(manifest) ||
      readFileSync(lock, "utf8") !== readFileSync(manifest, "utf8")
    ) {
      throw new Error(
        "Pods/Manifest.lock does not match Podfile.lock; fix Pods on the release ref first.",
      );
    }
  }
  for (const [index, step] of (config.preflight ?? []).entries()) {
    const logFile = join(root, `preflight-${index + 1}.log`);
    log(`Running ${step.command} ${step.args.join(" ")} (log: ${logFile})`);
    await runLogged(step.command, step.args, {
      cwd: join(source, step.cwd),
      logFile,
    });
  }
}

export function verifyEntitlements(actual, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(actual[key]) !== JSON.stringify(value))
      throw new Error(
        `Signed entitlement ${key} does not match the project config.`,
      );
  }
}

export function verifyArchiveExtras(config, appPath) {
  for (const file of config.archiveFiles ?? []) {
    if (!existsSync(join(appPath, file)))
      throw new Error(`Archive is missing required file: ${file}`);
  }
  if (config.entitlements) {
    execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], {
      stdio: "ignore",
    });
    const xml = execFileSync(
      "codesign",
      ["-d", "--entitlements", ":-", appPath],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const actual = JSON.parse(
      execFileSync("plutil", ["-convert", "json", "-o", "-", "-"], {
        input: xml,
        encoding: "utf8",
      }),
    );
    verifyEntitlements(actual, config.entitlements);
  }
}

async function waitForProcessing(api, appId, version, build) {
  const deadline = Date.now() + WAIT_LIMIT_MS;
  let result;
  for (;;) {
    result = await status(api, appId, version, build);
    const settled =
      result.ready ||
      ["FAILED", "INVALID"].includes(result.state) ||
      result.expired ||
      (result.state === "VALID" &&
        result.internalState &&
        result.internalState !== "PROCESSING");
    if (settled || Date.now() > deadline) return result;
    console.log(
      `  ${new Date().toISOString().slice(11, 19)} ${result.state}${result.internalState ? ` / ${result.internalState}` : ""}`,
    );
    await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
  }
}

export async function main(args) {
  const options = parseArgs(args);
  if (options.help) {
    console.log(usage);
    return 0;
  }
  if (!process.env.ASC_KEY_PATH)
    throw new Error(
      "Run this through `testflight release` so Apple credentials load.",
    );

  const repo = git(["rev-parse", "--show-toplevel"]);
  const config = loadConfig(repo);
  const projectArgs = config.workspace
    ? ["-workspace", config.workspace]
    : ["-project", config.project];
  log("Fetching origin");
  git(["fetch", "--quiet", "--tags", "origin"], repo);
  const sha = git(["rev-parse", "--verify", `${options.ref}^{commit}`], repo);
  if (
    !git(["branch", "--remotes", "--contains", sha, "--list", "origin/*"], repo)
  ) {
    throw new Error(
      `${options.ref} (${sha.slice(0, 12)}) is not on any origin branch; push it first.`,
    );
  }
  const previousTags = git(
    ["tag", "--points-at", sha, "--list", `${config.tagPrefix}*`],
    repo,
  );
  if (previousTags)
    console.log(
      `  Note: this commit was already released as ${previousTags.split("\n").join(", ")}.`,
    );

  const base = join(repo, config.artifactDir);
  mkdirSync(base, { recursive: true });
  const lockFile = join(base, "release.lock");
  let lock;
  try {
    lock = openSync(lockFile, "wx");
  } catch {
    throw new Error(
      `Another release is running (or crashed). If none is running, delete ${lockFile}.`,
    );
  }
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
  const root = join(base, `${stamp}-${sha.slice(0, 12)}`);
  const source = join(root, "source");
  const toolRevision = git(
    ["rev-parse", "HEAD"],
    fileURLToPath(new URL(".", import.meta.url)),
  );
  const record = {
    toolRevision,
    config,
    sha,
    ref: options.ref,
    startedAt: new Date().toISOString(),
    dryRun: options.dryRun,
  };
  const save = () =>
    writeFileSync(
      join(root, "release.json"),
      `${JSON.stringify(record, null, 2)}\n`,
    );
  try {
    writeFileSync(lock, `${process.pid} ${root}\n`);
    mkdirSync(root, { recursive: true });
    log(`Checking out ${sha.slice(0, 12)} into ${root}`);
    git(["worktree", "add", "--quiet", "--detach", source, sha], repo);

    // Use the selected commit's policy; fail if the invoking checkout has drifted.
    if (JSON.stringify(loadConfig(source)) !== JSON.stringify(config)) {
      throw new Error(
        "Release config differs at the selected ref. Check out that ref before releasing.",
      );
    }
    await preflight(config, source, root);
    log("Checking that code signing works without a prompt");
    checkSigning(root, options.provisioning);

    log("Reading build settings");
    const settingsJson = execFileSync(
      "xcodebuild",
      [
        ...projectArgs,
        "-scheme",
        config.scheme,
        "-configuration",
        config.configuration,
        "-destination",
        "generic/platform=iOS",
        "-showBuildSettings",
        "-json",
      ],
      {
        cwd: source,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    const settings = appSettings(JSON.parse(settingsJson), config);
    const version = options.version ?? settings.version;
    if (!/^\d+\.\d+(?:\.\d+)?$/.test(version ?? ""))
      throw new Error(`Invalid marketing version ${version}.`);

    log("Allocating build number from App Store Connect");
    const api = client(token);
    const target = await app(api, config.bundleId);
    const allocate = async () =>
      nextBuild(settings.localBuild, await buildHistory(api, target.id));
    const build = await allocate();
    const tag = tagName(version, build, config.tagPrefix);
    if (git(["tag", "--list", tag], repo))
      throw new Error(`Tag ${tag} already exists; reconcile before releasing.`);
    const uploads = await api.all(
      `/v1/apps/${encodeURIComponent(target.id)}/buildUploads?limit=200`,
    );
    const newest = uploads
      .filter((upload) => upload.attributes.state?.state === "COMPLETE")
      .map((upload) => upload.attributes.cfBundleShortVersionString)
      .filter((value) => /^\d+(?:\.\d+){1,2}$/.test(value ?? ""))
      .sort(compareVersions)
      .pop();
    if (newest && compareVersions(version, newest) < 0) {
      console.log(
        `  Warning: ${version} is lower than ${newest}, already in App Store Connect. Use --version to change it.`,
      );
    }
    record.version = version;
    record.build = build;
    record.tag = tag;
    save();
    console.log(`  ${version} (${build}) from ${sha.slice(0, 12)}`);

    if (git(["status", "--porcelain"], source))
      throw new Error("Release checkout is not clean.");
    const provisioning = options.provisioning
      ? ["-allowProvisioningUpdates"]
      : [];
    const archive = join(root, `${config.appName}.xcarchive`);
    log("Archiving (this takes a while; full log in archive.log)");
    await xcodebuild(
      [
        ...projectArgs,
        "-scheme",
        config.scheme,
        "-configuration",
        config.configuration,
        "-destination",
        "generic/platform=iOS",
        "-derivedDataPath",
        join(root, "derived"),
        "-archivePath",
        archive,
        ...provisioning,
        ...authArgs(),
        `MARKETING_VERSION=${version}`,
        `CURRENT_PROJECT_VERSION=${build}`,
        "archive",
      ],
      { cwd: source, logFile: join(root, "archive.log") },
    );
    const appPath = join(
      archive,
      "Products/Applications",
      `${config.appName}.app`,
    );
    const appPlist = join(appPath, "Info.plist");
    verifyAppInfo(
      Object.fromEntries(
        [
          "CFBundleIdentifier",
          "CFBundleShortVersionString",
          "CFBundleVersion",
        ].map((key) => [key, plistValue(appPlist, key)]),
      ),
      { version, build },
      config,
    );
    const archiveTeam = plistValue(
      join(archive, "Info.plist"),
      "ApplicationProperties.Team",
    );
    if (archiveTeam !== config.teamId)
      throw new Error(
        `Archive team is ${archiveTeam}; expected ${config.teamId}.`,
      );

    verifyArchiveExtras(config, appPath);

    const exportArgs = (plist, path) => [
      "-exportArchive",
      "-archivePath",
      archive,
      "-exportOptionsPlist",
      join(source, plist),
      "-exportPath",
      path,
      ...provisioning,
      ...authArgs(),
    ];
    if (options.dryRun) {
      log("Exporting IPA locally (dry run)");
      await xcodebuild(exportArgs(config.exportOptions, join(root, "export")), {
        cwd: source,
        logFile: join(root, "export.log"),
      });
      record.outcome = "exported";
      save();
      console.log(
        `\nDry run complete: ${join(root, "export")}. Nothing was uploaded or tagged.`,
      );
      return 0;
    }

    if ((await allocate()) !== build) {
      throw new Error(
        `Build ${build} was taken while archiving; rerun to allocate a new number.`,
      );
    }
    log("Uploading to App Store Connect (full log in upload.log)");
    record.outcome = "upload-started";
    save();
    await xcodebuild(exportArgs(config.uploadOptions, join(root, "upload")), {
      cwd: source,
      logFile: join(root, "upload.log"),
    });
    record.outcome = "uploaded";
    record.uploadedAt = new Date().toISOString();
    save();

    log(`Tagging ${sha.slice(0, 12)} as ${tag}`);
    git(
      [
        "tag",
        "--annotate",
        tag,
        sha,
        "--message",
        `TestFlight ${version} (${build})`,
      ],
      repo,
    );
    git(["push", "--quiet", "origin", `refs/tags/${tag}`], repo);
    record.tagged = true;
    save();

    if (options.wait) {
      log("Waiting for App Store Connect processing (up to 30 minutes)");
      const result = await waitForProcessing(api, target.id, version, build);
      record.processing = result;
      save();
      console.log(`  ${JSON.stringify(result)}`);
      if (["FAILED", "INVALID"].includes(result.state)) {
        console.log(
          `  Apple rejected the build. Delete the tag with: git push origin :refs/tags/${tag} && git tag -d ${tag}`,
        );
        return 1;
      }
      if (!result.ready)
        console.log(
          "  Not yet available to internal testers; check App Store Connect later.",
        );
    }
    console.log(
      `\nReleased ${version} (${build}) from ${sha.slice(0, 12)} as ${tag}.`,
    );
    git(["worktree", "remove", "--force", source], repo);
    return 0;
  } catch (error) {
    record.error = error.message;
    if (existsSync(root)) save();
    if (record.outcome === "upload-started") {
      const uploadLog = join(root, "upload.log");
      const text = existsSync(uploadLog) ? readFileSync(uploadLog, "utf8") : "";
      // Signing happens before anything is sent, so a signing failure means no upload.
      if (
        /\*\* EXPORT FAILED \*\*/.test(text) &&
        !/Upload succeeded|^Uploaded /m.test(text)
      ) {
        record.outcome = "upload-failed";
        save();
        if (/Cloud signing permission error/.test(text)) {
          console.error(`Nothing was uploaded: the App Store Connect API key has no access to cloud-managed distribution
certificates. Use an Admin API key, or import an Apple Distribution certificate (.p12) into this Keychain.`);
        } else {
          console.error(
            "Nothing was uploaded: the export failed before sending the build.",
          );
        }
      } else {
        console.error(
          "The upload may or may not have reached Apple. Check App Store Connect before rerunning.",
        );
      }
    }
    throw error;
  } finally {
    closeSync(lock);
    rmSync(lockFile, { force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(`\n✗ ${error.message}`);
    process.exitCode = 1;
  }
}
