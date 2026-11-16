#!/usr/bin/env node
// Keeps exactly one open `published-smoke-failure` issue in sync with the scheduled smoke test
// of the published package (same approach as scripts/ci/nightly-issue.mts):
//
//   - a job failed        -> open the issue, or update the open one
//   - every job passed    -> close the open issue with a comment
//   - anything else (cancelled or skipped jobs) -> leave the issue alone
//
// Env: NEEDS (toJSON(needs) of published-smoke.yml), RUN_URL, GH_TOKEN, GH_REPO.
// Flags: --dry-run     print the gh commands and the issue body instead of running them
//        --existing N  with --dry-run, pretend issue #N is already open
import { execFileSync } from 'node:child_process';

const LABEL = 'published-smoke-failure';
const LABEL_COLOR = 'D73A4A';
const LABEL_DESCRIPTION = 'The daily test of the published package failed';
const TITLE = '❌ The published package fails its daily smoke test';

// Keys are the job ids in published-smoke.yml.
const JOBS = [
  ['consumers', 'Consumer apps in Chromium and Firefox'],
  ['compat', 'Compatibility matrix against the 1.5.3 baseline'],
];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const existingFlag = args.indexOf('--existing');
const simulatedExisting = existingFlag >= 0 ? Number(args[existingFlag + 1]) : null;

const useColor =
  !process.env.NO_COLOR &&
  (process.stdout.isTTY || process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true');
const paint = (code) => (text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);
const green = paint(32);
const red = paint(31);
const yellow = paint(33);
const dim = paint(2);

function fail(message) {
  console.error(red(`❌ ${message}`));
  process.exit(1);
}

let needs;
try {
  needs = JSON.parse(process.env.NEEDS ?? '');
} catch {
  fail('NEEDS is missing or is not valid JSON.');
}
const runUrl = process.env.RUN_URL;
if (!runUrl) fail('RUN_URL is not set.');

const results = {};
for (const [key] of JOBS) {
  results[key] = needs[key]?.result;
  if (!results[key]) fail(`The job "${key}" is missing from NEEDS.`);
}

const cell = (status) =>
  status === 'success' ? '✅ Pass' : status === 'failure' ? '❌ Fail' : '⏭️ Skipped';
const failed = JOBS.filter(([key]) => results[key] === 'failure');
const allGreen = JOBS.every(([key]) => results[key] === 'success');

function issueBody() {
  return [
    '## ❌ Published package smoke test',
    '',
    '> [!CAUTION]',
    `> ${failed.length} ${failed.length === 1 ? 'check' : 'checks'} failed against the version on npm.`,
    '',
    '| | |',
    '| --- | --- |',
    `| Latest run | [**Open the run**](${runUrl}) |`,
    `| Updated | ${new Date().toISOString()} |`,
    '',
    '### 🧪 Checks',
    '',
    '| Check | Result |',
    '| --- | --- |',
    ...JOBS.map(([key, label]) => `| ${label} | ${cell(results[key])} |`),
    '',
    '### 💡 Next',
    '',
    '- Open the failed job in the run. A failure here means users can break even though the release passed.',
    '- Reproduce it with `E2E_SOURCE=npm bun run test:e2e`, or with `node scripts/ci/compat-matrix.mts rspack-plugin-svg-sprite@latest`.',
    '- This issue updates itself every day, and closes itself when the checks pass again.',
    '',
  ].join('\n');
}

function gh(ghArgs, input) {
  const shown = `gh ${ghArgs.map((a) => (/^[\w./:=@-]+$/.test(a) ? a : JSON.stringify(a))).join(' ')}`;
  if (dryRun) {
    console.log(dim(`$ ${shown}${input === undefined ? '' : '   # body on stdin'}`));
    if (input !== undefined) console.log(input.replace(/^/gm, dim('  | ')));
    return '';
  }
  return execFileSync('gh', ghArgs, {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'inherit'],
  });
}

function findOpenIssue() {
  const listArgs = ['issue', 'list', '--label', LABEL, '--state', 'open', '--json', 'number'];
  if (dryRun) {
    gh(listArgs);
    return Number.isInteger(simulatedExisting) ? simulatedExisting : null;
  }
  const numbers = JSON.parse(gh(listArgs) || '[]').map((i) => i.number);
  // If more than one is ever open, keep working on the oldest.
  return numbers.length > 0 ? Math.min(...numbers) : null;
}

console.log(`ℹ️ ${JOBS.map(([key]) => `${key} ${results[key]}`).join(', ')}`);

if (failed.length > 0) {
  const existing = findOpenIssue();
  if (existing === null) {
    gh([
      'label',
      'create',
      LABEL,
      '--color',
      LABEL_COLOR,
      '--description',
      LABEL_DESCRIPTION,
      '--force',
    ]);
    gh(['issue', 'create', '--title', TITLE, '--label', LABEL, '--body-file', '-'], issueBody());
    console.log(red('❌ A check failed. Opened the published-smoke-failure issue.'));
  } else {
    gh(['issue', 'edit', String(existing), '--body-file', '-'], issueBody());
    gh(
      ['issue', 'comment', String(existing), '--body-file', '-'],
      `❌ Still failing in [the latest run](${runUrl}): ${failed.map(([key]) => `\`${key}\``).join(', ')}.\n`,
    );
    console.log(red(`❌ A check failed. Updated issue #${existing}.`));
  }
} else if (allGreen) {
  const existing = findOpenIssue();
  if (existing === null) {
    console.log(green('✅ All checks passed and no published-smoke-failure issue is open.'));
  } else {
    gh(
      ['issue', 'comment', String(existing), '--body-file', '-'],
      `✅ All checks passed in [the latest run](${runUrl}). Closing this issue.\n`,
    );
    gh(['issue', 'close', String(existing), '--reason', 'completed']);
    console.log(green(`✅ All checks passed. Closed issue #${existing}.`));
  }
} else {
  console.log(
    yellow('⚠️ A check was cancelled or skipped, so the result is unknown. Left the issue as is.'),
  );
}
