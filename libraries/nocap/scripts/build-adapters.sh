#!/bin/bash

PARENT_DIR="adapters/default"
for dir in "$PARENT_DIR"/*/; do
  if [ -d "$dir" ]; then
    echo "Running pnpm build in $dir"
    cd "$dir" || exit
    pnpm build
    cd - || exit
  fi
done