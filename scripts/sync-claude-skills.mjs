#!/usr/bin/env node
// Fork-only (not upstream): rebuilds `.claude/skills/` as relative symlinks to
// the skills listed in `.claude-plugin/plugin.json`, so attaching this repo to
// a Claude Code session (for example as a side repo in a cloud session) loads
// the same set the plugin ships. Re-run after pulling from upstream; commit
// the result. `--check` exits non-zero if `.claude/skills/` is out of date.

import { readFileSync, readdirSync, lstatSync, readlinkSync, mkdirSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { dirname, join, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(repo, ".claude", "skills");
const check = process.argv.includes("--check");

const plugin = JSON.parse(readFileSync(join(repo, ".claude-plugin", "plugin.json"), "utf8"));
const wanted = new Map();
for (const p of plugin.skills) {
  const src = join(repo, p);
  if (!existsSync(join(src, "SKILL.md"))) throw new Error(`${p} has no SKILL.md`);
  const name = basename(src);
  if (wanted.has(name)) throw new Error(`two skills named ${name}`);
  wanted.set(name, relative(dest, src));
}

const problems = [];
const existing = existsSync(dest) ? readdirSync(dest) : [];
for (const name of existing) {
  const path = join(dest, name);
  const target = wanted.get(name);
  if (target && lstatSync(path).isSymbolicLink() && readlinkSync(path) === target) {
    wanted.delete(name);
    continue;
  }
  problems.push(`stale: ${name}`);
  if (!check) rmSync(path, { recursive: true, force: true });
}
for (const [name, target] of wanted) {
  problems.push(`missing: ${name}`);
  if (!check) {
    mkdirSync(dest, { recursive: true });
    symlinkSync(target, join(dest, name));
  }
}

if (check) {
  if (problems.length) {
    console.error(`.claude/skills/ is out of date (run node scripts/sync-claude-skills.mjs):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(".claude/skills/ matches plugin.json");
} else {
  console.log(problems.length ? `updated .claude/skills/:\n  ${problems.join("\n  ")}` : ".claude/skills/ already matches plugin.json");
}
