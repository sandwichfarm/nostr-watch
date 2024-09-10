#!/bin/bash

# Dry run flag
DRY_RUN=false

# Check if the --dry-run argument is passed
if [[ $1 == "--dry-run" ]]; then
  DRY_RUN=true
  echo "Running in dry-run mode. No changes will be made."
fi

# Create an array to store package names and their versions
package_versions=()

# Get all internal package names and their versions
for package_json in $(find . -type f -name "package.json" -not -path "*/node_modules/*"); do
  package_name=$(jq -r '.name // empty' "$package_json")
  package_version=$(jq -r '.version // empty' "$package_json")
  if [[ -n "$package_name" && -n "$package_version" ]]; then
    package_versions+=("$package_name:$package_version")
  fi
done

# Loop through all package.json files in the monorepo (excluding node_modules)
for file in $(find . -type f -name "package.json" -not -path "*/node_modules/*"); do
  echo "Processing $file..."

  # Look for internal dependencies that have "*"
  jq -r '.dependencies // {} | to_entries[] | select(.value == "*") | .key' "$file" | while read -r dep; do
    dep=$(echo $dep | tr -d '"')

    # Check if the dependency is an internal package
    for package in "${package_versions[@]}"; do
      package_name=${package%%:*}
      package_version=${package##*:}

      if [[ "$dep" == "$package_name" ]]; then
        echo "Found dependency $dep with version '*'. Will replace it with $package_version."

        if [[ $DRY_RUN == false ]]; then
          # Escape special characters in package name
          escaped_dep=$(echo "$dep" | sed 's/[]\/$*.^[]/\\&/g')
          # Replace "*" with the actual version in the dependency
          sed -i '' "s|\"$escaped_dep\": \"\*\"|\"$dep\": \"$package_version\"|g" "$file"
          echo "Replaced $dep version '*' with $package_version in $file."
        else
          echo "(Dry run) Would replace $dep version '*' with $package_version in $file."
        fi
        break
      fi
    done
  done
done

# Only commit if not in dry-run mode
if [[ $DRY_RUN == false ]]; then
  # Stage the changes
  git add .

  # Commit the changes
  git commit -m "Update internal dependencies with actual versions"
  echo "Changes committed."
else
  echo "Dry-run mode complete. No changes made."
fi
