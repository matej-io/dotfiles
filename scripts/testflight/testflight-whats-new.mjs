#!/usr/bin/env node
// Lists changes merged since the newest commit tagged by `testflight release`.
import { execFileSync } from "node:child_process";
import { loadConfig } from "./config.mjs";
import { pathToFileURL } from "node:url";

const usage = `Usage: testflight whats-new [--all] [--to <git-ref>]

  --all          Include changes outside the configured app directory.
  --to <ref>     Compare against this ref instead of origin/main.`;

// Newest by build number, since build numbers increase across all versions.
export function latestTag(tags, prefix = "testflight/") {
  return tags
    .map((tag) => ({
      tag,
      build: Number(
        tag.startsWith(prefix)
          ? /^\d+(?:\.\d+){1,2}-(\d+)$/.exec(tag.slice(prefix.length))?.[1]
          : NaN,
      ),
    }))
    .filter(({ build }) => Number.isSafeInteger(build))
    .sort((a, b) => a.build - b.build)
    .pop()?.tag;
}

export function main(args) {
  let all = false;
  let to = "origin/main";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help") return console.log(usage), 0;
    else if (args[i] === "--all") all = true;
    else if (args[i] === "--to" && args[i + 1]) to = args[++i];
    else throw new Error(usage);
  }
  const config = loadConfig();
  const git = (gitArgs) =>
    execFileSync("git", gitArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git(["fetch", "--quiet", "--tags", "origin"]);
  const tag = latestTag(
    git(["tag", "--list", `${config.tagPrefix}*`])
      .split("\n")
      .filter(Boolean),
    config.tagPrefix,
  );
  if (!tag)
    throw new Error(
      "No testflight/* tags yet. They are created by `testflight release`.",
    );
  const range = `${tag}..${to}`;
  const log = git([
    "log",
    "--first-parent",
    "--format=%h %ad %s",
    "--date=short",
    range,
    ...(all ? [] : ["--", config.appDir]),
  ]);
  console.log(
    `Since ${tag} (${git(["rev-parse", "--short", `${tag}^{commit}`])})${all ? "" : ", iOS app changes only"}:\n`,
  );
  console.log(log || "Nothing new.");
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
