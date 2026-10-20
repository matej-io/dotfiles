#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir } from "node:os";

// Explicit project token selection; never fall back to another project's token.
export function opEnvironment(tokenFile) {
  let token = process.env.OP_SERVICE_ACCOUNT_TOKEN?.trim();
  if (!token) {
    try {
      token = readFileSync(
        tokenFile.replace(/^~(?=\/|$)/, homedir()),
        "utf8",
      ).trim();
    } catch {
      throw new Error("Cannot read the configured 1Password token file.");
    }
  }
  if (!token) throw new Error("The 1Password service-account token is empty.");
  return { ...process.env, OP_SERVICE_ACCOUNT_TOKEN: token };
}

// Keep the key alive until the foreground child exits, including on termination.
export function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, env });
    const handlers = new Map(
      ["SIGINT", "SIGTERM", "SIGHUP"].map((signal) => {
        const handler = () => child.kill(signal);
        process.on(signal, handler);
        return [signal, handler];
      }),
    );
    const cleanup = () => {
      for (const [signal, handler] of handlers)
        process.removeListener(signal, handler);
    };
    child.on("error", () => {
      cleanup();
      reject(new Error("Could not start the requested command."));
    });
    child.on("close", (code, signal) => {
      cleanup();
      resolve(
        code ?? ({ SIGINT: 130, SIGTERM: 143, SIGHUP: 129 }[signal] || 1),
      );
    });
  });
}
