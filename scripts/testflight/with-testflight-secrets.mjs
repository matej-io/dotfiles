#!/usr/bin/env node
import {
  readFileSync,
  mkdtempSync,
  chmodSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createPrivateKey } from "node:crypto";
import { opEnvironment, run } from "./with-op-token.mjs";

import { loadConfig } from "./config.mjs";

const args = process.argv.slice(2);
const usage =
  "Internal usage: with-testflight-secrets.mjs --check | --xcodebuild <args...> | -- <command> [args...]";
let directory;
try {
  if (args[0] === "--help") {
    console.log(usage);
    process.exit(0);
  }
  if (
    !(
      (args[0] === "--check" && args.length === 1) ||
      (["--", "--xcodebuild"].includes(args[0]) && args.length > 1)
    )
  )
    throw new Error(usage);
  const config = loadConfig();
  let refs;
  try {
    refs = JSON.parse(readFileSync(config.secretsFile, "utf8"));
  } catch {
    throw new Error("Cannot read TestFlight secret-reference JSON.");
  }
  const opEnv = opEnvironment(config.tokenFile);
  const secrets = {};
  for (const field of ["keyId", "issuerId", "privateKey"]) {
    if (
      typeof refs[field] !== "string" ||
      !/^op:\/\/[^/]+\/[^/]+\/.+/.test(refs[field])
    ) {
      throw new Error(`TestFlight ${field} must be an op:// secret reference.`);
    }
    try {
      secrets[field] = execFileSync("op", ["read", refs[field]], {
        env: opEnv,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30000,
      }).trim();
    } catch {
      // Never relay raw CLI errors, stdout, or secret values.
      throw new Error(
        `Cannot load TestFlight ${field} from 1Password. Check op installation, token access, and the configured reference.`,
      );
    }
  }
  if (!/^[A-Z0-9]{10}$/.test(secrets.keyId))
    throw new Error("Invalid App Store Connect key ID.");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      secrets.issuerId,
    )
  ) {
    throw new Error("Invalid App Store Connect issuer ID; use a team API key.");
  }
  try {
    const key = createPrivateKey(secrets.privateKey);
    if (
      key.asymmetricKeyType !== "ec" ||
      key.asymmetricKeyDetails?.namedCurve !== "prime256v1"
    )
      throw new Error();
  } catch {
    throw new Error(
      "Invalid App Store Connect private key; store the original P-256 .p8 PEM with real newlines.",
    );
  }
  if (args[0] === "--check") {
    console.log(
      "TestFlight credentials loaded and format validated. Apple access and signing have not been checked.",
    );
  } else {
    directory = mkdtempSync(join(tmpdir(), "testflight-"));
    chmodSync(directory, 0o700);
    const keyPath = join(directory, `AuthKey_${secrets.keyId}.p8`);
    writeFileSync(keyPath, `${secrets.privateKey}\n`, { mode: 0o600 });
    const env = {
      ...process.env,
      ASC_KEY_ID: secrets.keyId,
      ASC_ISSUER_ID: secrets.issuerId,
      ASC_KEY_PATH: keyPath,
    };
    // The release command needs Apple's key, not the 1Password service-account token.
    delete env.OP_SERVICE_ACCOUNT_TOKEN;
    if (args[0] === "--xcodebuild") {
      process.exitCode = await run(
        "xcodebuild",
        [
          ...args.slice(1),
          "-authenticationKeyPath",
          keyPath,
          "-authenticationKeyID",
          secrets.keyId,
          "-authenticationKeyIssuerID",
          secrets.issuerId,
        ],
        env,
      );
    } else {
      process.exitCode = await run(args[1], args.slice(2), env);
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (directory) rmSync(directory, { recursive: true, force: true });
}
