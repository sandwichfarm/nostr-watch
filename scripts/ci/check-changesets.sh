#!/usr/bin/env bash
set -euo pipefail

# Exercise the installed CLI's parser even after all release notes are consumed.
# `status` only plans releases; this temporary changeset is never versioned.
changeset_probe="$(mktemp .changeset/ci-parser-XXXXXX.md)"
trap 'rm -f "$changeset_probe"' EXIT
printf '%s\n' '---' '"@nostrwatch/auditor": patch' '---' '' \
  'Changeset parser compatibility smoke test.' > "$changeset_probe"

pnpm --config.verify-deps-before-run=false changeset status
