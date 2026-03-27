#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');

const baseRef = process.argv[2] || 'origin/master';
const headRef = process.argv[3] || 'HEAD';

function run(command, args) {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function safeRun(command, args) {
    try {
        return run(command, args);
    } catch (error) {
        return '';
    }
}

function readPackageJson(ref, filePath) {
    const content = safeRun('git', ['show', `${ref}:${filePath}`]);
    if (!content) {
        return null;
    }
    try {
        return JSON.parse(content);
    } catch (error) {
        return null;
    }
}

function getChangedPackageJsonFiles() {
    const output = safeRun('git', ['diff', '--name-only', baseRef, headRef, '--', '**/package.json']);
    if (!output) {
        return [];
    }
    return output.split('\n').map(v => v.trim()).filter(Boolean);
}

function parseMajor(version) {
    if (!version) {
        return null;
    }
    const match = version.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

function classifyChange(oldVersion, newVersion) {
    if (!oldVersion) {
        return 'added';
    }
    if (!newVersion) {
        return 'removed';
    }
    const oldMajor = parseMajor(oldVersion);
    const newMajor = parseMajor(newVersion);
    if (oldMajor !== null && newMajor !== null && oldMajor !== newMajor) {
        return 'major';
    }
    return 'changed';
}

function getPackageMetadata(pkgName) {
    const json = safeRun('npm', ['view', pkgName, 'repository.url', 'homepage', '--json']);
    if (!json) {
        return {};
    }
    try {
        const data = JSON.parse(json);
        let repository = data.repository && data.repository.url ? data.repository.url : '';
        const homepage = data.homepage || '';
        if (repository.startsWith('git+')) {
            repository = repository.slice(4);
        }
        repository = repository.replace(/\.git$/, '');
        return { repository, homepage };
    } catch (error) {
        return {};
    }
}

function collectChanges(oldPkg, newPkg) {
    const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
    const changes = [];

    sections.forEach(section => {
        const before = oldPkg && oldPkg[section] ? oldPkg[section] : {};
        const after = newPkg && newPkg[section] ? newPkg[section] : {};
        const names = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();

        names.forEach(name => {
            const oldVersion = before[name];
            const newVersion = after[name];
            if (oldVersion === newVersion) {
                return;
            }
            changes.push({
                section,
                name,
                oldVersion: oldVersion || '',
                newVersion: newVersion || '',
                type: classifyChange(oldVersion, newVersion)
            });
        });
    });

    return changes;
}

function formatLinks(pkgName, metadata) {
    const links = [`[npm](https://www.npmjs.com/package/${pkgName})`];
    if (metadata.repository) {
        links.push(`[repo](${metadata.repository})`);
        if (metadata.repository.includes('github.com/')) {
            links.push(`[releases](${metadata.repository}/releases)`);
        }
    }
    if (metadata.homepage) {
        links.push(`[homepage](${metadata.homepage})`);
    }
    return links.join(' · ');
}

const changedFiles = getChangedPackageJsonFiles();

let lines = [];
lines.push('<!-- dependency-change-report -->');
lines.push('## Dependency change report');
lines.push('');
lines.push('This report shows dependency version changes in this PR and gives quick links to check release notes or repo history.');
lines.push('');

if (changedFiles.length === 0) {
    lines.push('No package.json dependency changes detected.');
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exit(0);
}

changedFiles.forEach(filePath => {
    const oldPkg = readPackageJson(baseRef, filePath) || {};
    const newPkg = readPackageJson(headRef, filePath) || {};
    const changes = collectChanges(oldPkg, newPkg);
    if (changes.length === 0) {
        return;
    }

    lines.push(`### ${filePath}`);
    lines.push('');
    lines.push('| Package | Scope | Change | Risk | Links |');
    lines.push('|---|---|---|---|---|');

    changes.forEach(change => {
        const metadata = getPackageMetadata(change.name);
        const risk = change.type === 'major' ? 'major version change' : change.type;
        const fromTo = change.oldVersion && change.newVersion ? `\`${change.oldVersion}\` → \`${change.newVersion}\`` : change.oldVersion ? `removed \`${change.oldVersion}\`` : `added \`${change.newVersion}\``;
        lines.push(`| ${change.name} | ${change.section} | ${fromTo} | ${risk} | ${formatLinks(change.name, metadata)} |`);
    });

    lines.push('');
});

lines.push('### Reviewer guidance');
lines.push('');
lines.push('- Check `major version change` rows first.');
lines.push('- Review package releases/changelog for renamed methods, parameter type changes, or removed exports.');
lines.push('- This report is informational only; runtime API safety still requires contract/smoke tests.');

process.stdout.write(`${lines.join('\n')}\n`);