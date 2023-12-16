#!/bin/bash

#https://gist.github.com/dskvr/a8b105aba87eba20a6a3d0228dcfb485
# Exit immediately if a command exits with a non-zero status.
set -e

# Variables
BRANCH_TO_SQUASH="main"
NEW_BRANCH="legacy-squash"
DRY_RUN=true # Set to false to perform actual operations

# Checkout the branch
git checkout $BRANCH_TO_SQUASH

# Fetch all commits and extract authors
AUTHORS=$(git log --format='%aN <%aE>' | sort | uniq)

# Create the co-authors message
CO_AUTHORS=""
while IFS= read -r AUTHOR; do
  CO_AUTHORS+="Co-authored-by: $AUTHOR"$'\n'
done < <(echo "$AUTHORS")

# Only check if a new branch exists and create it if not in dry run mode
if [ "$DRY_RUN" != true ]; then
    # Check if the new branch already exists
    if git rev-parse --verify "$NEW_BRANCH" > /dev/null 2>&1; then
        echo "Branch '$NEW_BRANCH' already exists. Exiting."
        exit 1
    fi

    # Create a new branch for the squash
    git checkout -b "$NEW_BRANCH"

    # Reset to the first commit of the branch
    FIRST_COMMIT=$(git rev-list --max-parents=0 HEAD)

    git reset "$FIRST_COMMIT"

    # Stage all changes
    git add -A
fi

# Commit with all co-authors
COMMIT_MESSAGE=$'Squashed commit \n\n'"${CO_AUTHORS}"

# Dry run check
if [ "$DRY_RUN" = true ]; then
    echo "Dry run is enabled. Commit message would be:"
    echo -e "$COMMIT_MESSAGE"
else
    git commit -m "$COMMIT_MESSAGE"
    # Show the final commit message for verification
    git log -1
fi