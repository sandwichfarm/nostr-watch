#!/bin/bash

# Exit on any error
set -e

# Run Changeset version bump
echo "Running Changeset version bump..."
yarn changeset version

# Check for changes in the git working directory
if [[ -n $(git status --porcelain) ]]; then
  # Stage all changes
  git add .

  # Commit changes
  echo "Committing version bump..."
  git commit -m "Version bumped by Changesets"

  # Push changes to the current branch
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  echo "Pushing changes to branch $CURRENT_BRANCH..."
  git push origin "$CURRENT_BRANCH"

  echo "Version bump committed and pushed."
else
  echo "No changes to commit."
fi