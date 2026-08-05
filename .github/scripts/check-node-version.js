'use strict';

/**
 * check-node-version.js
 *
 * Adapted from @alertlogic/al-aws-collector-js/scripts/check-lambda-node-runtime.js
 *
 * Fetches the AWS Lambda runtimes documentation, determines the highest
 * supported nodejs<N>.x runtime, compares it against .github/lambda-runtime.json,
 * and updates all Node.js version references in this repository when a change
 * is detected.
 *
 * Files updated:
 *   - local/sam-template.yaml
 *   - cfn/paws-collector.template
 *   - cfn/paws-collector-shared.template
 *   - ps_spec.yml
 *   - .github/workflows/code-coverage.yml
 *   - collectors/<*>/local/sam-template.yaml  (all collector SAM templates)
 *   - collectors/template/local/sam-template.yaml
 *   - .github/lambda-runtime.json  (state file)
 *
 * Emits GitHub Actions outputs: changed, target_major, target_runtime, changed_files
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const RUNTIME_DOCS_URL = 'https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html';
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const STATE_FILE = path.join(REPO_ROOT, '.github', 'lambda-runtime.json');

// ---------------------------------------------------------------------------
// Build the full list of files and their replacer patterns
// ---------------------------------------------------------------------------

function collectorsLocalSamTemplates() {
    const collectorsDir = path.join(REPO_ROOT, 'collectors');
    if (!fs.existsSync(collectorsDir)) {
        return [];
    }
    return fs.readdirSync(collectorsDir)
        .filter((name) => {
            const samPath = path.join(collectorsDir, name, 'local', 'sam-template.yaml');
            return fs.existsSync(samPath);
        })
        .map((name) => ({
            file: path.join(collectorsDir, name, 'local', 'sam-template.yaml'),
            replacers: [
                {
                    // YAML: Runtime: nodejs<N>.x
                    pattern: /Runtime:\s*nodejs\d+\.x/g,
                    replacement: (major) => `Runtime: nodejs${major}.x`
                }
            ]
        }));
}

function buildTargetFiles() {
    const cfnJsonPattern = {
        // JSON inside CFN template: "Runtime":"nodejs<N>.x" (with or without space)
        pattern: /"Runtime"\s*:\s*"nodejs\d+\.x"/g,
        replacement: (major) => `"Runtime": "nodejs${major}.x"`
    };

    return [
        // Root local SAM template
        {
            file: path.join(REPO_ROOT, 'local', 'sam-template.yaml'),
            replacers: [
                {
                    pattern: /Runtime:\s*nodejs\d+\.x/g,
                    replacement: (major) => `Runtime: nodejs${major}.x`
                }
            ]
        },
        // CFN templates (JSON format)
        {
            file: path.join(REPO_ROOT, 'cfn', 'paws-collector.template'),
            replacers: [cfnJsonPattern]
        },
        {
            file: path.join(REPO_ROOT, 'cfn', 'paws-collector-shared.template'),
            replacers: [cfnJsonPattern]
        },
        // ps_spec.yml: nvm use <N>
        {
            file: path.join(REPO_ROOT, 'ps_spec.yml'),
            replacers: [
                {
                    pattern: /nvm use \d+/g,
                    replacement: (major) => `nvm use ${major}`
                }
            ]
        },
        // Existing code-coverage workflow
        {
            file: path.join(REPO_ROOT, '.github', 'workflows', 'code-coverage.yml'),
            replacers: [
                {
                    // node-version: <N>.x
                    pattern: /node-version:\s*\d+\.x/g,
                    replacement: (major) => `node-version: ${major}.x`
                }
            ]
        },
        // All collectors' local SAM templates (dynamically resolved)
        ...collectorsLocalSamTemplates()
    ];
}

// ---------------------------------------------------------------------------
// GitHub Actions output helper
// ---------------------------------------------------------------------------

function writeGitHubOutput(key, value) {
    if (!process.env.GITHUB_OUTPUT) {
        return;
    }
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

// ---------------------------------------------------------------------------
// HTTP fetch with redirect following and retry
// ---------------------------------------------------------------------------

function requestWithRedirects(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        const req = https.get(
            url,
            {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; paws-collector-runtime-sync/1.0)',
                    Accept: 'text/html,application/xhtml+xml'
                }
            },
            (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    if (maxRedirects <= 0) {
                        reject(new Error('Too many redirects while fetching Lambda runtime docs'));
                        return;
                    }
                    const redirectedUrl = new URL(res.headers.location, url).toString();
                    resolve(requestWithRedirects(redirectedUrl, maxRedirects - 1));
                    return;
                }

                if (res.statusCode !== 200) {
                    reject(new Error(`Unexpected HTTP status ${res.statusCode}`));
                    return;
                }

                let body = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => resolve(body));
            }
        );

        req.on('timeout', () => { req.destroy(new Error('Request timed out')); });
        req.on('error', reject);
    });
}

async function fetchHtmlWithRetry(url, attempts = 3) {
    let lastError;
    for (let i = 1; i <= attempts; i += 1) {
        try {
            return await requestWithRedirects(url);
        } catch (error) {
            lastError = error;
            if (i < attempts) {
                console.warn(`Attempt ${i} failed: ${error.message} — retrying…`);
            }
        }
    }
    throw lastError;
}

// ---------------------------------------------------------------------------
// Runtime parsing
// ---------------------------------------------------------------------------

function parseHighestNodeRuntimeMajor(html) {
    const regex = /\bnodejs(\d+)\.x\b/gi;
    const majors = new Set();
    let match = regex.exec(html);

    while (match !== null) {
        const major = Number(match[1]);
        if (Number.isInteger(major) && major >= 10) {
            majors.add(major);
        }
        match = regex.exec(html);
    }

    if (majors.size === 0) {
        throw new Error('No Lambda Node.js runtimes were parsed from AWS docs');
    }

    return Math.max(...majors);
}

// ---------------------------------------------------------------------------
// State file
// ---------------------------------------------------------------------------

function readStateMajor() {
    if (!fs.existsSync(STATE_FILE)) {
        return null;
    }
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return Number(state.major);
}

function writeStateMajor(major) {
    const payload = {
        major,
        runtime: `nodejs${major}.x`,
        updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(STATE_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

// ---------------------------------------------------------------------------
// File updater
// ---------------------------------------------------------------------------

function updateTargetFiles(targetMajor) {
    const changed = [];
    const targetFiles = buildTargetFiles();

    for (const item of targetFiles) {
        if (!fs.existsSync(item.file)) {
            console.warn(`Skipping missing file: ${path.relative(REPO_ROOT, item.file)}`);
            continue;
        }

        const original = fs.readFileSync(item.file, 'utf8');
        let next = original;

        for (const replacer of item.replacers) {
            next = next.replace(replacer.pattern, replacer.replacement(targetMajor));
        }

        if (next !== original) {
            fs.writeFileSync(item.file, next, 'utf8');
            changed.push(path.relative(REPO_ROOT, item.file));
            console.log(`Updated: ${path.relative(REPO_ROOT, item.file)}`);
        } else {
            console.log(`No change: ${path.relative(REPO_ROOT, item.file)}`);
        }
    }

    return changed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    try {
        const html = await fetchHtmlWithRetry(RUNTIME_DOCS_URL);
        const targetMajor = parseHighestNodeRuntimeMajor(html);
        const targetRuntime = `nodejs${targetMajor}.x`;
        const currentMajor = readStateMajor();

        console.log(`Current runtime major: ${currentMajor}`);
        console.log(`Target runtime major:  ${targetMajor} (${targetRuntime})`);

        const shouldUpdate = currentMajor !== targetMajor;
        let changedFiles = [];

        if (shouldUpdate) {
            console.log('Runtime change detected — updating files…');
            changedFiles = updateTargetFiles(targetMajor);
            writeStateMajor(targetMajor);
            changedFiles.push(path.relative(REPO_ROOT, STATE_FILE));
        } else {
            console.log('Runtime is up to date — no changes needed.');
        }

        const summary = {
            currentMajor,
            targetMajor,
            targetRuntime,
            changed: shouldUpdate,
            changedFiles
        };

        console.log(JSON.stringify(summary, null, 2));

        writeGitHubOutput('changed', shouldUpdate ? 'true' : 'false');
        writeGitHubOutput('target_major', String(targetMajor));
        writeGitHubOutput('target_runtime', targetRuntime);
        writeGitHubOutput('changed_files', changedFiles.join(','));
    } catch (error) {
        console.error(`::error::${error.message}`);
        process.exit(1);
    }
}

main();
