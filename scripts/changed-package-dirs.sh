#!/bin/bash
# changed-package-dirs.sh
# Returns a JSON array of directory paths (relative to repo root) where package.json changed
# Usage: changed-package-dirs.sh <base-ref> <head-ref>

set -euo pipefail

BASE_REF="${1:-.}"
HEAD_REF="${2:-HEAD}"

# Array to collect changed dirs — initialize explicitly so set -u does not
# flag it as unbound when no matching files are found (empty loop body).
changed_dirs=()

# Get all changed package.json files relative to repo root
while IFS= read -r file; do
  # Extract directory from file path (e.g., "collectors/okta/package.json" → "collectors/okta")
  dir=$(dirname "$file")
  
  # Normalize root directory
  if [[ "$dir" == "." ]]; then
    dir="."
  fi
  
  changed_dirs+=("$dir")
done < <(git diff --name-only "$BASE_REF" "$HEAD_REF" -- "**/package.json" "**/package-lock.json")

# Remove duplicates and output as JSON array
if [[ ${#changed_dirs[@]} -gt 0 ]]; then
  printf '%s\n' "${changed_dirs[@]}" | sort -u | jq -R . | jq -s .
else
  echo "[]"
fi
