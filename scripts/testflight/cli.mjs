import { fileURLToPath } from "node:url";
import { repoRoot, loadConfig } from "./config.mjs";
import { run } from "./with-op-token.mjs";

const usage = `Usage: testflight [--repo <path>] <command> [options]

  check                    Validate credential formats (no Apple request)
  config                   Validate and display the project profile (no credentials)
  release                  Archive, upload, tag, and wait for processing
  status <version> <build>  Check internal TestFlight availability
  next-build <local-build> Calculate the next build number
  whats-new [--all]        Changes since the most recent TestFlight tag

release --dry-run exports locally without uploading or tagging.
Use <command> --help for options. Project policy: config/testflight.json.`;

export async function main(args) {
  if (args[0] === "--repo") {
    if (!args[1]) throw new Error("--repo needs a path.");
    process.chdir(args[1]);
    args = args.slice(2);
  }
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "-h") {
    console.log(usage);
    return 0;
  }
  if (
    ![
      "check",
      "config",
      "release",
      "status",
      "next-build",
      "whats-new",
    ].includes(command)
  )
    throw new Error(usage);
  const file = (name) => fileURLToPath(new URL(name, import.meta.url));
  // Help must not require credentials or even a configured checkout.
  if (rest.length === 1 && rest[0] === "--help") {
    if (command === "release" || command === "whats-new")
      return (await import(file(`testflight-${command}.mjs`))).main(rest);
    console.log(usage);
    return 0;
  }
  process.chdir(repoRoot());
  const config = loadConfig();
  if (command === "config") {
    if (rest.length) throw new Error("config takes no arguments.");
    console.log(JSON.stringify(config, null, 2));
    return 0;
  }
  if (command === "check" && rest.length)
    throw new Error("check takes no arguments.");
  if (command === "whats-new")
    return (await import("./testflight-whats-new.mjs")).main(rest);
  const child =
    command === "release"
      ? [file("testflight-release.mjs"), ...rest]
      : [file("testflight.mjs"), command, ...rest];
  return run(
    process.execPath,
    [
      file("with-testflight-secrets.mjs"),
      ...(command === "check"
        ? ["--check"]
        : ["--", process.execPath, ...child]),
    ],
    process.env,
  );
}
