#!/bin/bash 
PKG_NAME=$1
WORKSPACES_JSON=$(yarn workspaces info --json)
CLEANED_JSON=$(echo "$WORKSPACES_JSON" | grep -v 'yarn workspaces v' | grep -v 'Done in' | sed -n '/^{/,/^}/p')
PKG_PATH=$(echo "$CLEANED_JSON" | jq -r '.["@nostrwatch/'"$PKG_NAME"'"].location')
echo $PKG_PATH