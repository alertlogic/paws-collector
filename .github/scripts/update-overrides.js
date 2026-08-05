'use strict';

// Updates package.json overrides to address transitive vulnerabilities.
// Accepts --cwd <path> to operate on any collector directory.
//
// Usage: node update-overrides.js [--cwd <dir>]

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const cwdIndex = args.indexOf('--cwd');
const targetDir = cwdIndex !== -1 && args[cwdIndex + 1]
    ? path.resolve(args[cwdIndex + 1])
    : path.resolve(__dirname, '..', '..');

const packageJsonPath = path.join(targetDir, 'package.json');

if (!fs.existsSync(packageJsonPath)) {
    console.error(`package.json not found at: ${packageJsonPath}`);
    process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const overrides = packageJson.overrides || {};
const directDependencies = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
    ...Object.keys(packageJson.optionalDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {})
]);

function parseJson(raw) {
    try { return JSON.parse(raw); } catch { return null; }
}

function getAuditReport() {
    try {
        return parseJson(execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', cwd: targetDir }).trim());
    } catch (error) {
        return parseJson((error && error.stdout ? String(error.stdout) : '').trim());
    }
}

function getParentPackages(nodes, dependencyName) {
    if (!Array.isArray(nodes)) { return []; }
    const parents = new Set();
    for (const nodePath of nodes) {
        if (typeof nodePath !== 'string') { continue; }
        const parts = nodePath.split('/node_modules/').filter(Boolean).map((p) => p.replace(/^node_modules\//, ''));
        if (parts.length < 2) { continue; }
        const child = parts[parts.length - 1];
        const parent = parts[parts.length - 2];
        if (child === dependencyName && parent) { parents.add(parent); }
    }
    return Array.from(parents);
}

let changed = false;

// Step 1: Remove invalid / stale override keys
for (const name of Object.keys(overrides)) {
    const current = overrides[name];
    if (name.startsWith('node_modules/')) {
        delete overrides[name];
        changed = true;
        console.log(`Removed invalid override key: ${name}`);
        continue;
    }
    if (directDependencies.has(name) && typeof current === 'string') {
        delete overrides[name];
        changed = true;
        console.log(`Removed direct dependency override: ${name}`);
    }
}

// Step 2: Add overrides for vulnerable transitive dependencies
const auditReport = getAuditReport();
const vulnerabilities = auditReport && typeof auditReport === 'object' ? (auditReport.vulnerabilities || {}) : {};

for (const [name, vuln] of Object.entries(vulnerabilities)) {
    try {
        let targetVersion = null;
        const fix = vuln && vuln.fixAvailable;
        if (fix && typeof fix === 'object' && !Array.isArray(fix) && fix.name === name && fix.version) {
            targetVersion = String(fix.version).trim();
        }
        if (!targetVersion) {
            // No curated fix version — skip to avoid a potentially breaking major bump
            console.warn(`Skipping ${name}: no fix version in audit report — review manually.`);
            continue;
        }
        if (directDependencies.has(name)) {
            const parents = getParentPackages(vuln && vuln.nodes, name);
            for (const parent of parents) {
                const parentOverride = overrides[parent];
                if (parentOverride && typeof parentOverride !== 'object') {
                    console.warn(`Skipping ${parent}>${name}: parent override is not an object.`);
                    continue;
                }
                const scoped = parentOverride || {};
                const nextValue = `^${targetVersion}`;
                if (scoped[name] !== nextValue) {
                    scoped[name] = nextValue;
                    overrides[parent] = scoped;
                    changed = true;
                    console.log(`Added scoped override ${parent}>${name}: ${nextValue}`);
                }
            }
            continue;
        }
        if (!Object.prototype.hasOwnProperty.call(overrides, name)) {
            overrides[name] = `^${targetVersion}`;
            changed = true;
            console.log(`Added override ${name}: ^${targetVersion}`);
        }
    } catch (error) {
        console.warn(`Skipping ${name}: ${error.message}`);
    }
}

// Step 3: Bump existing overrides to latest satisfying version (within range)
for (const name of Object.keys(overrides)) {
    const current = overrides[name];
    const prefixMatch = typeof current === 'string' ? current.match(/^[^0-9]*/) : null;
    if (typeof current !== 'string' || prefixMatch === null) {
        console.warn(`Skipping ${name}: unsupported override format.`);
        continue;
    }
    try {
        const raw = execFileSync('npm', ['view', `${name}@${current}`, 'version', '--json'], { encoding: 'utf8', cwd: targetDir }).trim();
        let resolved = raw;
        try { resolved = JSON.parse(raw); } catch { /* keep raw */ }
        const latest = Array.isArray(resolved) ? resolved[resolved.length - 1] : resolved;
        const normalizedLatest = String(latest).trim();
        if (!normalizedLatest || normalizedLatest === 'undefined') {
            throw new Error(`could not resolve latest version for ${name}@${current}`);
        }
        const next = `${prefixMatch[0]}${normalizedLatest}`;
        if (next !== current) {
            overrides[name] = next;
            changed = true;
            console.log(`${name}: ${current} -> ${next}`);
        } else {
            console.log(`${name}: ${current} (up to date)`);
        }
    } catch (error) {
        console.warn(`Skipping ${name}: ${error.message}`);
    }
}

if (!changed) {
    console.log('npm overrides already up to date.');
    process.exit(0);
}

packageJson.overrides = overrides;
fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
console.log(`Wrote updated overrides to: ${packageJsonPath}`);

