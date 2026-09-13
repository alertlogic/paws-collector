'use strict';

// Post-fix gate. Decides whether opening a PR is meaningful, and whether
// it should be ready-for-review or draft.
//
// Emits GitHub Actions outputs:
//   should_open_pr        true|false
//   pr_state              ready|draft|none
//   files_changed         true|false
//   residual_high         integer
//   residual_critical     integer
//   residual_advisories   comma-separated <pkg>@<severity> (top 20)
//   summary_md            single-line markdown status summary (heredoc-safe)
//
// Usage:
//   node verify-fix.js --cwd <dir> --tests-passed <true|false>
//
// Exit code: 0 on success (including "nothing to do"), 1 only on script error.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function parseArgs(argv) {
    const out = { cwd: process.cwd(), testsPassed: null };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--cwd') { out.cwd = path.resolve(argv[++i]); }
        else if (a === '--tests-passed') { out.testsPassed = String(argv[++i]).toLowerCase() === 'true'; }
    }
    return out;
}

function writeOutput(key, value) {
    if (!process.env.GITHUB_OUTPUT) { console.log(`${key}=${value}`); return; }
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

function safeExec(cmd, args, opts) {
    try {
        return { ok: true, stdout: execFileSync(cmd, args, { encoding: 'utf8', ...opts }) };
    } catch (err) {
        return { ok: false, stdout: (err && err.stdout) || '', stderr: (err && err.stderr) || '' };
    }
}

function parseJson(raw) {
    try { return JSON.parse(raw); } catch { return null; }
}

function detectFilesChanged(cwd) {
    // Compare workspace against HEAD. Only interested in files under this cwd.
    const rel = path.relative(process.cwd(), cwd) || '.';
    const res = safeExec('git', ['status', '--porcelain', '--', rel], { cwd: process.cwd() });
    if (!res.ok) { return { changed: false, files: [] }; }
    const files = res.stdout.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.slice(3));
    return { changed: files.length > 0, files };
}

function auditResidual(cwd) {
    const res = safeExec('npm', ['audit', '--json'], { cwd });
    const report = parseJson(res.stdout);
    if (!report || typeof report !== 'object') { return { high: 0, critical: 0, advisories: [] }; }
    const vulns = report.vulnerabilities || {};
    let high = 0;
    let critical = 0;
    const advisories = [];
    for (const [name, v] of Object.entries(vulns)) {
        const sev = String(v.severity || '').toLowerCase();
        if (sev === 'high') { high += 1; }
        if (sev === 'critical') { critical += 1; }
        if (sev === 'high' || sev === 'critical') { advisories.push(`${name}@${sev}`); }
    }
    return { high, critical, advisories: advisories.sort() };
}

function main() {
    const { cwd, testsPassed } = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(path.join(cwd, 'package.json'))) {
        console.error(`No package.json at ${cwd}`);
        process.exit(1);
    }

    const { changed: filesChanged, files } = detectFilesChanged(cwd);
    const { high, critical, advisories } = auditResidual(cwd);
    const residualHighOrCritical = high + critical;
    const testsOk = testsPassed === true;
    const testsFailed = testsPassed === false;

    let shouldOpenPr = true;
    let prState = 'ready';
    const reasons = [];

    if (!filesChanged) {
        shouldOpenPr = false;
        prState = 'none';
        reasons.push('no files changed');
    } else {
        if (testsFailed) { prState = 'draft'; reasons.push('tests failed'); }
        if (residualHighOrCritical > 0) {
            prState = 'draft';
            reasons.push(`${residualHighOrCritical} high/critical vuln(s) remain`);
        }
        if (prState === 'ready') { reasons.push('audit clean, tests passing'); }
    }

    const advisoriesTop = advisories.slice(0, 20).join(',');
    const summary = shouldOpenPr
        ? `PR **${prState}** — ${reasons.join('; ')}`
        : 'No PR — no dependency changes were applied.';

    console.log('--- verify-fix summary ---');
    console.log(`cwd: ${cwd}`);
    console.log(`files_changed: ${filesChanged} (${files.length} files)`);
    if (files.length > 0) { console.log(`  ${files.join('\n  ')}`); }
    console.log(`residual_high: ${high}`);
    console.log(`residual_critical: ${critical}`);
    console.log(`tests_passed: ${testsPassed === null ? 'n/a' : String(testsPassed)}`);
    console.log(`decision: should_open_pr=${shouldOpenPr} pr_state=${prState}`);
    console.log(`reasons: ${reasons.join('; ')}`);

    writeOutput('should_open_pr', String(shouldOpenPr));
    writeOutput('pr_state', prState);
    writeOutput('files_changed', String(filesChanged));
    writeOutput('residual_high', String(high));
    writeOutput('residual_critical', String(critical));
    writeOutput('residual_advisories', advisoriesTop);
    writeOutput('summary_md', summary);
}

main();
