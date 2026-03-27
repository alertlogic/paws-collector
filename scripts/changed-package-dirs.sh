#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${1:-origin/master}"
HEAD_REF="${2:-HEAD}"

changed_files=$(git diff --name-only "$BASE_REF" "$HEAD_REF" -- \
  "**/package.json" "**/package-lock.json" || true)

if [[ -z "$changed_files" ]]; then
  echo "[]"
  exit 0
fi

declare -A seen
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  dir=$(dirname "$file")
  if [[ "$dir" == "." ]]; then
    seen["."]=1
  else
    seen["$dir"]=1
  fi
done <<< "$changed_files"

printf '%s\n' "${!seen[@]}" | sort | jq -R -s -c 'split("\n")[:-1]'
