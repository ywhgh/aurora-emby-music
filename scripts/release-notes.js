#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const RELEASE_NOTES_PATH = path.join(ROOT, "RELEASE_NOTES.md");

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  return String(pkg.version || "").trim();
}

function normalizeVersion(value) {
  return String(value || "").trim().replace(/^v/i, "");
}

function extractReleaseNotes(markdown, version) {
  const wanted = normalizeVersion(version);
  if (!wanted) {
    return "";
  }
  const lines = String(markdown).split(/\r?\n/);
  const headingIndex = lines.findIndex(
    (line) => /^##\s+/.test(line) && normalizeVersion(line.replace(/^##\s+/, "")) === wanted,
  );
  if (headingIndex === -1) {
    return "";
  }
  const body = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      break;
    }
    body.push(lines[index]);
  }
  return body.join("\n").trim();
}

function main() {
  const version = normalizeVersion(process.argv[2] || readPackageVersion());
  const markdown = fs.readFileSync(RELEASE_NOTES_PATH, "utf8");
  const notes = extractReleaseNotes(markdown, version);
  if (!notes) {
    console.error(`release-notes: no "## ${version}" section found in RELEASE_NOTES.md`);
    process.exit(1);
  }
  process.stdout.write(`${notes}\n`);
}

if (require.main === module) {
  main();
}

module.exports = { extractReleaseNotes, normalizeVersion };
