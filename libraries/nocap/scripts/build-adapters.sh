#!/bin/bash

PARENT_DIR="adapters/default"
for dir in "$PARENT_DIR"/*/; do
  if [ -d "$dir" ]; then
    echo "Running yarn build in $dir"
    cd "$dir" || exit
    yarn build
    cd - || exit
  fi
done