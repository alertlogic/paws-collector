#!/usr/bin/env bash
# audit-with-ignore.sh <directory> <audit-level> [include-dev|omit-dev]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "${SCRIPT_DIR}/audit-with-ignore.js" "$@"
