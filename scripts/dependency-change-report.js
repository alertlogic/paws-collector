#!/usr/bin/env node
/**
 * dependency-change-report.js
 * Generates a markdown report of dependency changes between two git refs
 * Usage: node dependency-change-report.js <base-ref> <head-ref>
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const baseRef = process.argv[2] || 'origin/master';
const headRef = process.argv[3] || 'HEAD';

const EXPIRY_WARNING_DAYS = 30;

/**
 * Get all changed package.json files
 */
function getChangedPackageFiles() {
  try {
    const output = execFileSync(
      'git',
      ['diff', '--name-only', baseRef, headRef, '--', '**/package.json', '**/package-lock.json'],
      { encoding: 'utf8' }
    );
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('Error getting changed files:', error.message);
    return [];
  }
}

function getChangedDirs(changedFiles) {
  return [...new Set(changedFiles.map((file) => path.dirname(file)))];
}

function getCollectorName(dir) {
  if (dir === '.') {
    return 'root';
  }

  const parts = dir.split('/');
  if (parts[0] === 'collectors' && parts[1]) {
    return parts[1];
  }

  return dir;
}

function loadIgnoreList() {
  const ignorePath = path.resolve('.audit-ignore.json');
  if (!fs.existsSync(ignorePath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(ignorePath, 'utf8'));
    return Array.isArray(parsed.vulnerabilities) ? parsed.vulnerabilities : [];
  } catch (error) {
    console.error(`Error parsing ${ignorePath}:`, error.message);
    return [];
  }
}

/**
 * Parse package.json and extract dependencies
 */
function parsePackageJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return {};
  }
}

/**
 * Get dependencies from a specific ref
 */
function getDependenciesAtRef(ref, packageJsonPath) {
  try {
    const content = execFileSync('git', ['show', `${ref}:${packageJsonPath}`], { encoding: 'utf8' });
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

function runAuditForDir(dir, level = 'high') {
  try {
    const auditRaw = execFileSync(
      'npm',
      ['audit', '--prefix', dir, `--audit-level=${level}`, '--json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return JSON.parse(auditRaw);
  } catch (error) {
    // npm audit exits non-zero when vulnerabilities are found, but often still writes valid JSON.
    const output = (error && error.stdout ? String(error.stdout) : '').trim();
    if (output) {
      try {
        return JSON.parse(output);
      } catch (_parseErr) {
        return { _auditError: output };
      }
    }
    return { _auditError: error.message };
  }
}

function changelogUrl(pkgName) {
  return `https://www.npmjs.com/package/${encodeURIComponent(pkgName)}?activeTab=versions`;
}

function checkIgnoreExpiry(ignoreList) {
  const today = new Date();
  const warnings = [];
  for (const entry of ignoreList) {
    if (!entry.nextReviewDate) continue;
    const reviewDate = new Date(entry.nextReviewDate);
    if (isNaN(reviewDate.getTime())) continue;
    const daysUntil = Math.ceil((reviewDate - today) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 0) {
      warnings.push(`⛔ **EXPIRED**: \`${entry.package}\` (${entry.cve || entry.id}) ignore entry expired on ${entry.nextReviewDate}. Review or remove from .audit-ignore.json.`);
    } else if (daysUntil <= EXPIRY_WARNING_DAYS) {
      warnings.push(`⚠️ **EXPIRING SOON**: \`${entry.package}\` (${entry.cve || entry.id}) ignore entry expires in ${daysUntil} day(s) on ${entry.nextReviewDate}.`);
    }
  }
  return warnings;
}

function normalizeFixVersion(fixAvailable) {
  if (!fixAvailable) {
    return 'No automatic fix available';
  }

  if (fixAvailable === true) {
    return 'Run npm audit fix';
  }

  if (typeof fixAvailable === 'object') {
    const target = `${fixAvailable.name || 'package'}@${fixAvailable.version || 'latest'}`;
    return fixAvailable.isSemVerMajor
      ? `${target} (major upgrade)`
      : target;
  }

  return 'Manual review required';
}

function extractCves(via) {
  const cves = [];
  if (!Array.isArray(via)) {
    return cves;
  }

  for (const item of via) {
    if (item && typeof item === 'object' && item.cve) {
      cves.push(item.cve);
    }
  }

  return cves;
}

function isIgnoredVulnerability(ignoreList, dir, packageName, cves) {
  return ignoreList.find((item) => {
    if (!item || item.package !== packageName) {
      return false;
    }

    if (Array.isArray(item.collectors) && item.collectors.length > 0) {
      const collectorMatched = item.collectors.includes('*') || item.collectors.includes(dir) || item.collectors.includes(getCollectorName(dir));
      if (!collectorMatched) {
        return false;
      }
    }

    if (item.cve && cves.length > 0) {
      return cves.includes(item.cve);
    }

    return true;
  });
}

function buildAuditRows(dir, ignoreList) {
  const audit = runAuditForDir(dir, 'high');
  if (audit._auditError) {
    return {
      rows: [],
      error: audit._auditError
    };
  }

  const vulnerabilities = audit.vulnerabilities || {};
  const rows = [];

  for (const [pkgName, details] of Object.entries(vulnerabilities)) {
    const cves = extractCves(details.via);
    const ignoredRule = isIgnoredVulnerability(ignoreList, dir, pkgName, cves);
    rows.push({
      collector: getCollectorName(dir),
      directory: dir,
      packageName: pkgName,
      severity: details.severity || 'unknown',
      affectedRange: details.range || 'N/A',
      fix: normalizeFixVersion(details.fixAvailable),
      cve: cves[0] || 'N/A',
      status: ignoredRule ? 'ignored' : 'open',
      note: ignoredRule ? (ignoredRule.reason || 'Ignored by policy') : 'Action required'
    });
  }

  return { rows, error: null };
}

/**
 * Compare dependencies and get changes
 */
function comparePackages(basePkg, headPkg) {
  const baseDeps = { ...basePkg.dependencies, ...basePkg.devDependencies };
  const headDeps = { ...headPkg.dependencies, ...headPkg.devDependencies };
  
  const changes = [];
  
  // Check for added or updated packages
  for (const [name, version] of Object.entries(headDeps)) {
    if (!baseDeps[name]) {
      changes.push({ name, type: 'added', from: null, to: version });
    } else if (baseDeps[name] !== version) {
      changes.push({ name, type: 'updated', from: baseDeps[name], to: version });
    }
  }
  
  // Check for removed packages
  for (const [name, version] of Object.entries(baseDeps)) {
    if (!headDeps[name]) {
      changes.push({ name, type: 'removed', from: version, to: null });
    }
  }
  
  return changes;
}

/**
 * Generate markdown report
 */
function generateReport() {
  const changedFiles = getChangedPackageFiles();
  const ignoreList = loadIgnoreList();
  const changedDirs = getChangedDirs(changedFiles);
  const expiryWarnings = checkIgnoreExpiry(ignoreList);
  
  if (changedFiles.length === 0) {
    return '<!-- dependency-change-report -->\n\n## Dependency Changes\n\nNo package dependency changes detected.';
  }
  
  let report = '<!-- dependency-change-report -->\n\n';

  if (expiryWarnings.length > 0) {
    report += '## ⚠️ Ignore Policy Expiry Warnings\n\n';
    for (const w of expiryWarnings) {
      report += `- ${w}\n`;
    }
    report += '\n';
  }

  report += '## Dependency Changes\n\n';
  
  const allChanges = {};
  
  const packageJsonChanges = changedFiles.filter((file) => file.endsWith('/package.json') || file === 'package.json');

  for (const changedFile of packageJsonChanges) {
    const dir = path.dirname(changedFile);
    const dirLabel = dir === '.' ? 'Root' : dir;
    
    // Get base and head versions
    const basePkg = getDependenciesAtRef(baseRef, changedFile);
    const headPkg = parsePackageJson(changedFile);
    
    const changes = comparePackages(basePkg, headPkg);
    
    if (changes.length > 0) {
      if (!allChanges[dirLabel]) {
        allChanges[dirLabel] = [];
      }
      allChanges[dirLabel].push(...changes);
    }
  }
  
  // Format report by directory
  for (const [dir, changes] of Object.entries(allChanges)) {
    report += `\n### ${dir}\n\n`;
    report += '| Package | Change | From | To | Changelog |\n';
    report += '|---|---|---|---|---|\n';

    for (const change of changes) {
      const fromVer = change.from || '—';
      const toVer = change.to || '—';
      const fromMajor = change.from ? parseInt(change.from.replace(/[^\d]/, ''), 10) : NaN;
      const toMajor = change.to ? parseInt(change.to.replace(/[^\d]/, ''), 10) : NaN;
      const isMajorBump = change.type === 'updated' && !isNaN(fromMajor) && !isNaN(toMajor) && toMajor > fromMajor;
      const badge = change.type === 'added' ? '✨ Added' :
                    change.type === 'updated' ? (isMajorBump ? '🚨 Updated (major)' : '📦 Updated') :
                    '❌ Removed';
      const link = `[npm](${changelogUrl(change.name)})`;
      report += `| ${change.name} | ${badge} | \`${fromVer}\` | \`${toVer}\` | ${link} |\n`;
    }
  }

  report += '\n\n## Vulnerability Analysis (npm audit)\n\n';
  report += '| Collector | Directory | Package | Severity | Affected Range | CVE | Recommended Fix | Status | Notes | npm |\n';
  report += '|---|---|---|---|---|---|---|---|---|---|\n';

  const uniqueDirs = changedDirs;
  let hasAuditRows = false;

  for (const dir of uniqueDirs) {
    const auditResult = buildAuditRows(dir, ignoreList);
    if (auditResult.error) {
      report += `| ${getCollectorName(dir)} | ${dir} | N/A | N/A | N/A | N/A | N/A | info | Audit output unavailable (${auditResult.error.replace(/\n/g, ' ').slice(0, 120)}) | — |\n`;
      continue;
    }

    if (auditResult.rows.length === 0) {
      report += `| ${getCollectorName(dir)} | ${dir} | None | — | — | — | No fix needed | clean | No high vulnerabilities detected | — |\n`;
      continue;
    }

    hasAuditRows = true;
    for (const row of auditResult.rows) {
      report += `| ${row.collector} | ${row.directory} | ${row.packageName} | ${row.severity} | \`${row.affectedRange}\` | ${row.cve} | ${row.fix} | ${row.status} | ${row.note} | [npm](${changelogUrl(row.packageName)}) |\n`;
    }
  }

  if (!hasAuditRows) {
    report += '\nAll scanned directories are clean at the configured audit threshold, or vulnerabilities are already marked in .audit-ignore.json.\n';
  }
  
  report += '\n\n---\n*Generated by Dependency PR Gate*\n';
  
  return report;
}

console.log(generateReport());
