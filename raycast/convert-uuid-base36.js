#!/usr/bin/env node

// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Convert UUID ↔ Base36
// @raycast.mode compact

// Optional parameters:
// @raycast.icon 🔢
// @raycast.argument1 { "type": "text", "placeholder": "UUID or 25-character Base36", "optional": true }
// @raycast.packageName Developer Utilities

// Documentation:
// @raycast.description Converts UUID ↔ Base36 and copies the result.
// @raycast.author Matej Ukmar
// @raycast.authorURL https://raycast.com/matej_ukmar

const { execFileSync } = require("node:child_process");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BASE36_RE = /^[0-9a-z]{25}$/i;
const MAX_UUID = (1n << 128n) - 1n;

function readClipboard() {
  return execFileSync("/usr/bin/pbpaste", [], {
    encoding: "utf8",
  }).trim();
}

function copyToClipboard(value) {
  execFileSync("/usr/bin/pbcopy", [], {
    input: value,
  });
}

function parseBase36(value) {
  let result = 0n;

  for (const character of value.toLowerCase()) {
    const digit = parseInt(character, 36);
    result = result * 36n + BigInt(digit);
  }

  return result;
}

function uuidToBase36(uuid) {
  const hex = uuid.replaceAll("-", "");
  const value = BigInt(`0x${hex}`);

  return value.toString(36).padStart(25, "0");
}

function base36ToUuid(base36) {
  const value = parseBase36(base36);

  if (value > MAX_UUID) {
    throw new Error("Base36 value exceeds the UUID 128-bit range.");
  }

  const hex = value.toString(16).padStart(32, "0");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

try {
  const argument = process.argv.slice(2).join(" ").trim();
  const input = argument || readClipboard();

  if (!input) {
    throw new Error("Enter a value or copy one to the clipboard.");
  }

  let output;

  if (UUID_RE.test(input)) {
    output = uuidToBase36(input);
  } else if (BASE36_RE.test(input)) {
    output = base36ToUuid(input);
  } else {
    throw new Error(
      "Expected a dashed UUID or exactly 25 Base36 characters."
    );
  }

  copyToClipboard(output);
  console.log(output);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
