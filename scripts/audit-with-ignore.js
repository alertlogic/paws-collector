#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || '.';
const level = (process.argv[3] || 'high').toLowerCase();
const depModeArg = (process.argv[4] || 'include-dev').toLowerCase();
const includeDev = depModeArg === 'include-dev';

const levelRank = {
    info: 0,
    low: 1,
    moderate: 2,
    high: 3,
    critical: 4
};

const minRank = levelRank[level] !== undefined ? levelRank[level] : levelRank.high;

function run(command, args, options = {}) {
    return execFileSync(command, args, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        ...options
    });
}

function safeRun(command, args, options = {}) {
    try {
        return run(command, args, options);
    } catch (error) {
        if (error && error.stdout) {
            return String(error.stdout);
        }
        return '';
    }
}

function getRepoRoot() {
    try {
        return run('git', ['rev-parse', '--show-toplevel']).trim();
    } catch (error) {
        return process.cwd();
    }
}

function normalizeId(id) {
    if (!id || typeof id !== 'string') {
        return '';
    }
    const trimmed = id.trim();
    if (!trimmed) {
        return '';
    }
    const upper = trimmed.toUpperCase();
    if (upper.startsWith('GHSA-') || upper.startsWith('CVE-')) {
        return upper;
    }
    const parts = trimmed.split('/');
    const tail = parts[parts.length - 1].toUpperCase();
    if (tail.startsWith('GHSA-') || tail.startsWith('CVE-')) {
        return tail;
    }
    return upper;
}

function collectIdsFromVia(via) {
    const ids = new Set();
    if (!Array.isArray(via)) {
        return ids;
    }

    via.forEach(item => {
        if (typeof item === 'string') {
            const normalized = normalizeId(item);
            if (normalized) {
                ids.add(normalized);
            }
            return;
        }

        if (item && typeof item === 'object') {
            if (item.cve) {
                const normalized = normalizeId(String(item.cve));
                if (normalized) {
                    ids.add(normalized);
                }
            }
            if (item.url) {
                const normalized = normalizeId(String(item.url));
                if (normalized) {
                    ids.add(normalized);
                }
            }
            if (item.source && String(item.source).toUpperCase().startsWith('GHSA-')) {
                ids.add(String(item.source).toUpperCase());
            }
        }
    });

    return ids;
}

function loadIgnoreSet(ignoreFilePath) {
    const ids = new Set();
    if (!fs.existsSync(ignoreFilePath)) {
        return ids;
    }

    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(ignoreFilePath, 'utf8'));
    } catch (error) {
        return ids;
    }

    const today = new Date().toISOString().slice(0, 10);
    const ignore = Array.isArray(parsed.ignore) ? parsed.ignore : [];

    ignore.forEach(entry => {
        const cve = normalizeId(entry && entry.cve ? String(entry.cve) : '');
        const ghsa = normalizeId(entry && entry.ghsa ? String(entry.ghsa) : '');

        if (cve) {
            ids.add(cve);
        }
        if (ghsa) {
            ids.add(ghsa);
        }

        const expires = entry && entry.expires ? String(entry.expires) : '';
        if (expires && expires < today) {
            const packageName = entry && entry.package ? String(entry.package) : 'unknown-package';
            const reason = entry && entry.reason ? String(entry.reason) : 'No reason provided';
            const identifier = cve || ghsa || 'unknown-id';
            console.log(` WARNING: Ignored CVE ${identifier} (package: ${packageName}) has EXPIRED (expires: ${expires}).`);
            console.log(`   Reason was: ${reason}`);
            console.log('   Please re-evaluate and either fix or extend the expiry in .audit-ignore.json.');
        }
    });

    return ids;
}

console.log(`==> npm audit [dir=${dir}] [level=${level}] [mode=${includeDev ? 'include-dev' : 'omit-dev'}]`);

const repoRoot = getRepoRoot();
const auditArgs = ['audit', '--json'];
if (!includeDev) {
    auditArgs.push('--omit=dev');
}

const auditCwd = dir === '.' ? repoRoot : path.resolve(repoRoot, dir);
const auditRaw = safeRun('npm', auditArgs, { cwd: auditCwd });

if (!auditRaw.trim()) {
    console.log('No audit output — skipping.');
    process.exit(0);
}

let audit;
try {
    audit = JSON.parse(auditRaw);
} catch (error) {
    console.log('Unable to parse npm audit JSON output.');
    process.exit(1);
}

const ignoreFile = path.join(repoRoot, '.audit-ignore.json');
const ignoredIds = loadIgnoreSet(ignoreFile);

const vulnerabilities = audit && audit.vulnerabilities ? audit.vulnerabilities : {};
let foundViolation = false;

Object.entries(vulnerabilities).forEach(([packageName, vuln]) => {
    const severity = (vuln && vuln.severity ? vuln.severity : 'info').toLowerCase();
    const severityValue = levelRank[severity] !== undefined ? levelRank[severity] : 0;

    if (severityValue < minRank) {
        return;
    }

    const ids = collectIdsFromVia(vuln && vuln.via ? vuln.via : []);
    const idList = Array.from(ids);

    const isIgnored = idList.length > 0 && idList.some(id => ignoredIds.has(id));
    const printableIds = idList.length > 0 ? idList.join(' ') : 'no-cve-id';

    if (isIgnored) {
        console.log(`   ⏭  Skipped (in .audit-ignore.json): ${packageName} [${severity}] ${printableIds}`);
        return;
    }

    console.log(`  VIOLATION: ${packageName} [${severity}] ${printableIds}`);
    foundViolation = true;
});

if (foundViolation) {
    console.log('');
    console.log(`FAILED: Unfixed vulnerabilities at or above '${level}' severity found.`);
    console.log('To intentionally accept a CVE, add it to .audit-ignore.json with a reason and expiry date.');
    process.exit(1);
}

console.log(`PASSED: No unignored vulnerabilities at or above '${level}' severity.`);
process.exit(0);
