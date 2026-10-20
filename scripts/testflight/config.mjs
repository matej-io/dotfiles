import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { isAbsolute } from "node:path";

function relativePath(value, label) {
  if (
    typeof value !== "string" ||
    !value ||
    isAbsolute(value) ||
    value.split(/[\\/]/).includes("..")
  ) {
    throw new Error(`${label} must be a path inside the repository.`);
  }
}

export function validateConfig(c) {
  if (!c || c.schemaVersion !== 1)
    throw new Error("Unsupported TestFlight config schemaVersion; expected 1.");
  for (const key of [
    "name",
    "bundleId",
    "teamId",
    "scheme",
    "target",
    "configuration",
    "appName",
    "tagPrefix",
    "tokenFile",
  ]) {
    if (typeof c[key] !== "string" || !c[key].trim())
      throw new Error(`Missing TestFlight ${key}.`);
  }
  if (!/^[A-Z0-9]{10}$/.test(c.teamId))
    throw new Error("Invalid TestFlight teamId.");
  if (!/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(c.bundleId))
    throw new Error("Invalid TestFlight bundleId.");
  if (!/^[A-Za-z0-9_-]+$/.test(c.appName))
    throw new Error("Invalid TestFlight appName.");
  if (!/^[A-Za-z0-9_/-]+$/.test(c.tagPrefix) || c.tagPrefix.startsWith("-"))
    throw new Error("Invalid TestFlight tagPrefix.");
  if (Boolean(c.workspace) === Boolean(c.project))
    throw new Error("Configure exactly one Xcode workspace or project.");
  for (const key of [
    "appDir",
    "artifactDir",
    "secretsFile",
    "exportOptions",
    "uploadOptions",
  ])
    relativePath(c[key], key);
  for (const key of ["workspace", "project", "podsDir"])
    if (c[key] !== undefined) relativePath(c[key], key);
  if (c.artifactDir === "." || !c.artifactDir.startsWith("."))
    throw new Error("artifactDir must be a hidden release directory.");
  for (const key of ["requiredFiles", "archiveFiles"]) {
    if (c[key] !== undefined && !Array.isArray(c[key]))
      throw new Error(`${key} must be an array.`);
    for (const value of c[key] ?? []) relativePath(value, key);
  }
  if (c.preflight !== undefined && !Array.isArray(c.preflight))
    throw new Error("preflight must be an array.");
  for (const step of c.preflight ?? []) {
    if (
      typeof step.command !== "string" ||
      !step.command ||
      !Array.isArray(step.args) ||
      step.args.some((a) => typeof a !== "string")
    )
      throw new Error("Invalid preflight command/args.");
    relativePath(step.cwd, "preflight cwd");
  }
  if (
    c.entitlements !== undefined &&
    (!c.entitlements ||
      Array.isArray(c.entitlements) ||
      typeof c.entitlements !== "object")
  )
    throw new Error("entitlements must be an object.");
  return c;
}

export function repoRoot(cwd = process.cwd()) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error(
      "Run testflight inside a configured Git repository (or use --repo <path>).",
    );
  }
}

export function loadConfig(root = repoRoot()) {
  let config;
  try {
    config = JSON.parse(readFileSync(`${root}/config/testflight.json`, "utf8"));
  } catch {
    throw new Error(
      "Cannot read config/testflight.json in the selected repository.",
    );
  }
  return validateConfig(config);
}
