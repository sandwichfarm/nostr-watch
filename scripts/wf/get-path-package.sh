#!/bin/bash 
PKG_NAME=$1

# Get the raw JSON output from 'yarn workspaces info --json'
WORKSPACES_JSON=$(yarn workspaces info --json)

# Extract only the JSON part using grep and sed
CLEANED_JSON=$(echo "$WORKSPACES_JSON" | grep -v 'yarn workspaces v' | grep -v 'Done in' | sed -n '/^{/,/^}/p')

# Process the JSON with jq to extract the package path
PKG_PATH=$(echo "$CLEANED_JSON" | jq -r '.["@nostrwatch/'"$PKG_NAME"'"].location')

echo $PKG_PATH

# echo "the_path=$PKG_PATH" >> "$GITHUB_OUTPUT"