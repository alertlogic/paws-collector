#!/bin/bash
# audit-with-ignore.sh
# Runs npm audit excluding known acceptable CVEs tracked in .audit-ignore.json
# Usage: audit-with-ignore.sh <dir> <audit-level> [include-dev]

set -euo pipefail

DIR="${1:-.}"
AUDIT_LEVEL="${2:-high}"
INCLUDE_DEV="${3:-}"

REPO_ROOT=$(git rev-parse --show-toplevel)
IGNORE_FILE="$REPO_ROOT/.audit-ignore.json"

# Build npm audit command
AUDIT_CMD="npm audit --prefix $DIR --audit-level=$AUDIT_LEVEL"

if [[ "$INCLUDE_DEV" == "include-dev" ]]; then
  # Default: include dev dependencies
  :
else
  AUDIT_CMD="$AUDIT_CMD --production"
fi

# Run audit in JSON mode and print detailed actionable summary.
AUDIT_JSON=""
if AUDIT_JSON=$(npm audit --prefix "$DIR" --audit-level="$AUDIT_LEVEL" --json 2>/dev/null); then
  :
else
  # npm audit exits non-zero when vulnerabilities are present.
  AUDIT_JSON=$(npm audit --prefix "$DIR" --audit-level="$AUDIT_LEVEL" --json 2>/dev/null || true)
fi

if [[ -z "$AUDIT_JSON" ]]; then
  echo "Unable to read npm audit output for $DIR"
  exit 1
fi

AUDIT_TMP=$(mktemp)
printf '%s' "$AUDIT_JSON" > "$AUDIT_TMP"

DIR="$DIR" IGNORE_FILE="$IGNORE_FILE" node - "$AUDIT_TMP" <<'EOF'
const fs = require('fs');

const auditPath = process.argv[2];
const dir = process.env.DIR || '.';
const ignoreFile = process.env.IGNORE_FILE;

let ignoredRules = [];
if (ignoreFile && fs.existsSync(ignoreFile)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(ignoreFile, 'utf8'));
    ignoredRules = Array.isArray(parsed.vulnerabilities) ? parsed.vulnerabilities : [];
  } catch (e) {
    // Ignore parse errors in policy file and proceed with full reporting.
  }
}

function getCollectorName(directory) {
  if (directory === '.') return 'root';
  const parts = directory.split('/');
  if (parts[0] === 'collectors' && parts[1]) return parts[1];
  return directory;
}

function normalizeFixVersion(fixAvailable) {
  if (!fixAvailable) return 'No automatic fix available';
  if (fixAvailable === true) return 'npm audit fix';
  if (typeof fixAvailable === 'object') {
    const target = `${fixAvailable.name || 'package'}@${fixAvailable.version || 'latest'}`;
    return fixAvailable.isSemVerMajor ? `${target} (major upgrade)` : target;
  }
  return 'Manual review required';
}

function extractCves(via) {
  if (!Array.isArray(via)) return [];
  return via
    .filter((entry) => entry && typeof entry === 'object' && entry.cve)
    .map((entry) => entry.cve);
}

function isIgnored(pkg, cves, directory) {
  return ignoredRules.find((rule) => {
    if (!rule || rule.package !== pkg) return false;
    if (Array.isArray(rule.collectors) && rule.collectors.length > 0) {
      const matched =
        rule.collectors.includes('*') ||
        rule.collectors.includes(directory) ||
        rule.collectors.includes(getCollectorName(directory));
      if (!matched) return false;
    }
    if (rule.cve && cves.length > 0) return cves.includes(rule.cve);
    return true;
  });
}

let audit = {};
try {
  audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
} catch (e) {
  console.log(`Unable to parse npm audit JSON for ${dir}`);
  process.exit(1);
}

const vulnerabilities = audit.vulnerabilities || {};
const entries = Object.entries(vulnerabilities);
const collector = getCollectorName(dir);

console.log(`Collector: ${collector}`);
console.log(`Directory: ${dir}`);

if (entries.length === 0) {
  console.log('Status: clean (no vulnerabilities at selected level)');
  process.exit(0);
}

let actionableCount = 0;
for (const [pkg, details] of entries) {
  const cves = extractCves(details.via);
  const ignoredRule = isIgnored(pkg, cves, dir);
  const status = ignoredRule ? 'ignored' : 'open';
  const note = ignoredRule ? (ignoredRule.reason || 'Ignored by policy') : 'Action required';
  if (!ignoredRule) actionableCount += 1;

  console.log('---');
  console.log(`Package: ${pkg}`);
  console.log(`Severity: ${details.severity || 'unknown'}`);
  console.log(`Affected range: ${details.range || 'N/A'}`);
  console.log(`CVE: ${cves[0] || 'N/A'}`);
  console.log(`Fix: ${normalizeFixVersion(details.fixAvailable)}`);
  console.log(`Status: ${status}`);
  console.log(`Note: ${note}`);
}

process.exit(actionableCount > 0 ? 1 : 0);
EOF

rm -f "$AUDIT_TMP"
