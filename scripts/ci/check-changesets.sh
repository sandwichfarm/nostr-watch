#!/usr/bin/env bash
set -euo pipefail

# A changeset that names only packages in the config's `ignore` list is never
# consumed by `changeset version`. It then stays in .changeset/ forever, and the
# Release workflow fails on every push trying to open an empty version PR.
node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';

const dir = '.changeset';
const { ignore = [] } = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
const ignored = new Set(ignore);
const stuck = [];

for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith('.md') || file === 'README.md') continue;
  const text = fs.readFileSync(path.join(dir, file), 'utf8');
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
  const packages = [...front.matchAll(/^\s*["']?([^"':\s]+)["']?\s*:/gm)].map((m) => m[1]);
  if (packages.length > 0 && packages.every((name) => ignored.has(name))) {
    stuck.push(`${file} (${packages.join(', ')})`);
  }
}

if (stuck.length) {
  console.error('These changesets only name packages ignored in .changeset/config.json and would never be released:');
  for (const entry of stuck) console.error(`  - ${entry}`);
  console.error('Remove them, or name a package that is released.');
  process.exit(1);
}
NODE

# Exercise the installed CLI's parser even after all release notes are consumed.
# `status` only plans releases; this temporary changeset is never versioned.
changeset_probe="$(mktemp .changeset/ci-parser-XXXXXX.md)"
trap 'rm -f "$changeset_probe"' EXIT
printf '%s\n' '---' '"@nostrwatch/auditor": patch' '---' '' \
  'Changeset parser compatibility smoke test.' > "$changeset_probe"

pnpm --config.verify-deps-before-run=false changeset status
