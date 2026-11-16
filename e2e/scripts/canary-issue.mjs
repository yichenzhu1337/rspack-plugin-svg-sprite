#!/usr/bin/env node
// Keeps exactly one open `canary-failure` issue in sync with the weekly downstream canaries
// (same approach as smoke-issue.mjs):
//
//   - the canary jobs failed   -> open the issue, or update the open one
//   - every canary job passed  -> close the open issue with a comment
//   - anything else (cancelled or skipped jobs) -> leave the issue alone
//
// Env: NEEDS (toJSON(needs) of canaries.yml), RUN_URL, GH_TOKEN, GH_REPO.
// Flags: --dry-run     print the gh commands and the issue body instead of running them
//        --existing N  with --dry-run, pretend issue #N is already open
import { execFileSync } from 'node:child_process';

const LABEL = 'canary-failure';
const LABEL_COLOR = 'D73A4A';
const LABEL_DESCRIPTION = 'A real svg-sprite-loader project no longer builds the same sprite';
const TITLE = '❌ A downstream canary no longer builds the same sprite';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const existingFlag = args.indexOf('--existing');
const simulatedExisting = existingFlag >= 0 ? Number(args[existingFlag + 1]) : null;

function fail(message) {
  console.error(`❌ ${message}`);
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

// The key is the matrix job id in canaries.yml.
const result = needs.canary?.result;
if (!result) fail('The job "canary" is missing from NEEDS.');

function issueBody() {
  return [
    '## ❌ Downstream canaries',
    '',
    '> [!CAUTION]',
    '> A real open-source project that uses `svg-sprite-loader` no longer builds the same sprite symbols with this package.',
    '',
    '| | |',
    '| --- | --- |',
    `| Latest run | [**Open the run**](${runUrl}) |`,
    `| Updated | ${new Date().toISOString()} |`,
    '',
    '### 💡 Next',
    '',
    '- Open the failed `canary` jobs in the run. Each one names the project, its pinned commit and the symbols that differ.',
    '- Reproduce it with `node e2e/scripts/canary.mjs --project <name>`. The projects and their patches are in `e2e/canaries.mjs`.',
    '- If a project itself changed its output on purpose, fix `e2e/canaries.mjs` (a new pin, or an `expectedDiff` with a reason).',
    '- This issue updates itself every week, and closes itself when the canaries pass again.',
    '',
  ].join('\n');
}

function gh(ghArgs, input) {
  if (dryRun) {
    console.log(
      `$ gh ${ghArgs.map((a) => (/^[\w./:=@-]+$/.test(a) ? a : JSON.stringify(a))).join(' ')}`,
    );
    if (input !== undefined) console.log(input.replace(/^/gm, '  | '));
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

console.log(`ℹ️ canary ${result}`);

if (result === 'failure') {
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
    console.log('❌ A canary failed. Opened the canary-failure issue.');
  } else {
    gh(['issue', 'edit', String(existing), '--body-file', '-'], issueBody());
    gh(
      ['issue', 'comment', String(existing), '--body-file', '-'],
      `❌ Still failing in [the latest run](${runUrl}).\n`,
    );
    console.log(`❌ A canary failed. Updated issue #${existing}.`);
  }
} else if (result === 'success') {
  const existing = findOpenIssue();
  if (existing === null) {
    console.log('✅ Every canary passed and no canary-failure issue is open.');
  } else {
    gh(
      ['issue', 'comment', String(existing), '--body-file', '-'],
      `✅ Every canary passed in [the latest run](${runUrl}). Closing this issue.\n`,
    );
    gh(['issue', 'close', String(existing), '--reason', 'completed']);
    console.log(`✅ Every canary passed. Closed issue #${existing}.`);
  }
} else {
  console.log(
    '⚠️ A canary was cancelled or skipped, so the result is unknown. Left the issue as is.',
  );
}
