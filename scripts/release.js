#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { extractReleaseNotes } = require("./release-notes.js");

const ROOT = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");

function git(args, options = {}) {
  const output = execFileSync("git", args, { cwd: ROOT, encoding: "utf8", ...options });
  return typeof output === "string" ? output.trim() : "";
}

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function main() {
  const version = String(JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version || "").trim();
  if (!version) {
    fail("package.json has no version");
  }
  const tag = `v${version}`;

  if (git(["status", "--porcelain"])) {
    fail("working tree is not clean; commit or stash changes before releasing");
  }

  const notes = extractReleaseNotes(fs.readFileSync(path.join(ROOT, "RELEASE_NOTES.md"), "utf8"), version);
  if (!notes) {
    fail(`RELEASE_NOTES.md has no "## ${version}" section`);
  }

  const existingTags = git(["tag", "--list", tag]);
  if (existingTags) {
    fail(`tag ${tag} already exists`);
  }

  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);

  if (DRY_RUN) {
    console.log(`release: would tag ${tag} on ${branch} and push to origin`);
    console.log(`release: notes preview\n${notes}`);
    return;
  }

  git(["tag", "-a", tag, "-m", `${tag}`]);
  git(["push", "origin", branch], { stdio: "inherit" });
  git(["push", "origin", tag], { stdio: "inherit" });
  console.log(`release: pushed ${tag}; the Release workflow will publish it on GitHub`);
}

if (require.main === module) {
  main();
}
