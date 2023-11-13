#!/bin/bash
set -e
BRANCH_TO_SQUASH="main"
#
git checkout $BRANCH_TO_SQUASH
AUTHORS=$(git log --format='%aN <%aE>' | sort | uniq)
CO_AUTHORS=""
for AUTHOR in $AUTHORS; do
  CO_AUTHORS+=$'Co-authored-by: '"$AUTHOR"$'\n'
done
NEW_BRANCH="legacy-squash"
git checkout -b $NEW_BRANCH
FIRST_COMMIT=$(git rev-list --max-parents=0 HEAD)
git reset $FIRST_COMMIT
git add -A
COMMIT_MESSAGE=$'Legacy Commit (squashed) @v0.2.13 \n\n'"${CO_AUTHORS}"
git commit -m "$COMMIT_MESSAGE"
git log -1
