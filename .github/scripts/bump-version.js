'use strict';

/**
 * bump-version.js
 *
 * Increments the patch component of the `version` field in a package.json file.
 *
 * Usage:
 *   node .github/scripts/bump-version.js <path/to/package.json>
 *
 * Example:
 *   node .github/scripts/bump-version.js package.json
 *   node .github/scripts/bump-version.js collectors/auth0/package.json
 */

const fs = require('fs');
const path = require('path');

const target = process.argv[2];

if (!target) {
    console.error('Usage: node bump-version.js <path/to/package.json>');
    process.exit(1);
}

const filePath = path.resolve(target);

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const current = pkg.version;

if (!current || typeof current !== 'string') {
    console.error(`No valid version field found in: ${filePath}`);
    process.exit(1);
}

const parts = current.split('.');
if (parts.length !== 3 || parts.some((p) => isNaN(Number(p)))) {
    console.error(`Version "${current}" is not a valid semver (major.minor.patch) in: ${filePath}`);
    process.exit(1);
}

const [major, minor, patch] = parts.map(Number);
const next = `${major}.${minor}.${patch + 1}`;

pkg.version = next;
fs.writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

console.log(`${path.relative(process.cwd(), filePath)}: ${current} -> ${next}`);
