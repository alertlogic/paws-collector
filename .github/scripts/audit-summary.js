'use strict';

// Runs `npm audit --json` and `git diff package.json`, writes GitHub Actions
// outputs for use in PR bodies:
//   vuln_count, vuln_table, dep_changes_table, new_version
//
// Usage: node audit-summary.js [--cwd <dir>]

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const cwdIndex = args.indexOf('--cwd');
const targetDir = cwdIndex !== -1 && args[cwdIndex + 1]
    ? path.resolve(args[cwdIndex + 1])
    : process.cwd();

function writeOutput(key, value) {
    if (!process.env.GITHUB_OUTPUT) { console.log(`${key}=${value}`); return; }
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

function writeMultilineOutput(key, value) {
    const delimiter = `GHADELIM_${key.toUpperCase()}`;
    if (!process.env.GITHUB_OUTPUT) { console.log(`${key}:\n${value}`); return; }
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}<<${delimiter}\n${value}\n${delimiter}\n`);
}

function getAuditReport() {
    try {
        return JSON.parse(execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', cwd: targetDir }));
    } catch (err) {
        // npm audit exits non-zero when vulnerabilities exist; stdout is still valid JSON
        try { return JSON.parse(err.stdout || '{}'); } catch { return {}; }
    }
}

const advisoryUrlByPkg = {};
const report = getAuditReport();
const vulns = report.vulnerabilities || {};
const vulnRows = [];

for (const [, vuln] of Object.entries(vulns)) {
    if (!vuln.name) { continue; }
    const advisories = Array.isArray(vuln.via) ? vuln.via.filter((v) => v && typeof v === 'object') : [];
    if (advisories.length === 0) { continue; }

    for (const advisory of advisories) {
        const cves = Array.isArray(advisory.cve) && advisory.cve.length > 0 ? advisory.cve.join(', ') : '_none_';
        const url = advisory.url || '';
        const advisoryLink = url ? `[${url.split('/').pop()}](${url})` : '_no link_';
        const fixStatus = vuln.fixAvailable ? 'available' : 'manual review';
        if (url) { advisoryUrlByPkg[vuln.name] = url; }
        vulnRows.push(`| \`${vuln.name}\` | ${vuln.severity || 'unknown'} | ${cves} | ${advisoryLink} | ${fixStatus} |`);
    }
}

const VULN_HEADER = '| Package | Severity | CVE | Advisory | Fix |\n|---|---|---|---|---|';
const vulnTable = vulnRows.length > 0 ? `${VULN_HEADER}\n${vulnRows.join('\n')}` : '_No vulnerabilities with known advisories found._';

function getDepChangesTable() {
    let diff = '';
    try {
        diff = execFileSync('git', ['diff', 'package.json'], { encoding: 'utf8', cwd: targetDir });
    } catch {
        return '_Could not read git diff for package.json._';
    }
    if (!diff.trim()) { return '_No changes detected in package.json._'; }

    const linePattern = /"([^"]+)":\s*"([^"{}[\]]+)"/;
    const removed = {};
    const added = {};

    for (const line of diff.split('\n')) {
        if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) { continue; }
        const match = linePattern.exec(line.slice(1));
        if (!match) { continue; }
        const [, name, version] = match;
        if (line.startsWith('-')) { removed[name] = version; }
        else if (line.startsWith('+')) { added[name] = version; }
    }

    const changeRows = [];
    for (const name of Object.keys(added)) {
        const fromVer = removed[name];
        const toVer = added[name];
        if (fromVer === toVer) { continue; }
        const url = advisoryUrlByPkg[name];
        const pkgLabel = url ? `[\`${name}\`](${url})` : `\`${name}\``;
        changeRows.push(`| ${pkgLabel} | ${fromVer ? `\`${fromVer}\`` : '_new_'} | \`${toVer}\` |`);
    }
    for (const name of Object.keys(removed)) {
        if (added[name]) { continue; }
        const url = advisoryUrlByPkg[name];
        const pkgLabel = url ? `[\`${name}\`](${url})` : `\`${name}\``;
        changeRows.push(`| ${pkgLabel} | \`${removed[name]}\` | _removed_ |`);
    }

    if (changeRows.length === 0) { return '_No version changes found in package.json._'; }
    return `| Package | From | To |\n|---|---|---|\n${changeRows.join('\n')}`;
}

const depChangesTable = getDepChangesTable();

let newVersion = 'unknown';
try {
    newVersion = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8')).version || 'unknown';
} catch { /* non-fatal */ }

writeOutput('vuln_count', String(vulnRows.length));
writeOutput('new_version', newVersion);
writeMultilineOutput('vuln_table', vulnTable);
writeMultilineOutput('dep_changes_table', depChangesTable);

console.log(`Vulnerabilities found: ${vulnRows.length}`);
console.log(`Package version: ${newVersion}`);
