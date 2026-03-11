#!/bin/bash
set -e

echo "Running changeset version bump..."
pnpm exec changeset version

if [[ -n $(git status --porcelain) ]]; then
  git add .
  git commit -m "chore: version packages"
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  git push origin "$CURRENT_BRANCH"
  echo "Version bump committed and pushed."
else
  echo "No changes to commit."
fi

if [[ "$1" == "--publish" ]]; then
  echo "Publishing packages..."
  pnpm exec changeset publish
  git push --follow-tags
fi
