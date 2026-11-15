#!/usr/bin/env node
// Nightly report: keeps exactly one open `nightly-failure` issue in sync with the nightly run.
//
//   - a blocking job failed  -> open the issue, or update the open one
//   - all blocking jobs pass -> close the open issue with a comment
//   - anything else (cancelled or skipped blocking jobs) -> leave the issue alone
//
// Non-blocking jobs are listed in the issue but never open it.
//
// Env: NEEDS (toJSON(needs) of the nightly workflow), RUN_URL, GH_TOKEN, GH_REPO.
//      Optional: COMMIT_SHA, COMMIT_URL.
// Flags: --dry-run     print the gh commands and the issue body instead of running them
//        --existing N  with --dry-run, pretend issue #N is already open
import { execFileSync } from 'node:child_process';

const LABEL = 'nightly-failure';
const LABEL_COLOR = 'D73A4A';
const LABEL_DESCRIPTION = 'The nightly compatibility run failed';
const TITLE = '❌ Nightly compatibility run is failing';

// Keys are the job ids in nightly.yml.
const BLOCKING = [
  ['test', 'Full matrix (Node 22, 24, 26 on Ubuntu, Windows, macOS)'],
  ['next-ubuntu', 'Next Ubuntu (ubuntu-26.04)'],
];
const NON_BLOCKING = [
  ['canary', 'Rspack and Rsbuild canary'],
  ['peer-floor', 'Peer floor (@rspack/core 0.x)'],
  ['audit', 'Dependency audit'],
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
const group = (title) => process.env.GITHUB_ACTIONS && console.log(`::group::${title}`);
const endGroup = () => process.env.GITHUB_ACTIONS && console.log('::endgroup::');

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

/** A job's outcome. Non-blocking jobs publish `outputs.status`, because their own result hides failures. */
function outcome(key) {
  const job = needs[key];
  if (!job) return 'missing';
  return job.outputs?.status || job.result || 'missing';
}

const results = {};
for (const [key] of [...BLOCKING, ...NON_BLOCKING]) results[key] = outcome(key);

for (const [key] of BLOCKING) {
  if (results[key] === 'missing') fail(`The blocking job "${key}" is missing from NEEDS.`);
}

function cell(status, blocking) {
  if (status === 'success') return '✅ Pass';
  if (status === 'failure') return blocking ? '❌ Fail' : '⚠️ Failed, not blocking';
  if (status === 'cancelled') return '⏭️ Cancelled';
  return '⏭️ Skipped';
}

const failedBlocking = BLOCKING.filter(([key]) => results[key] === 'failure');
const allGreen = BLOCKING.every(([key]) => results[key] === 'success');

function table(rows, blocking) {
  return [
    '| Check | Result |',
    '| --- | --- |',
    ...rows.map(([key, label]) => `| ${label} | ${cell(results[key], blocking)} |`),
  ].join('\n');
}

function issueBody() {
  const warned = NON_BLOCKING.filter(([key]) => results[key] === 'failure');
  const sha = process.env.COMMIT_SHA;
  const commit = sha
    ? process.env.COMMIT_URL
      ? `[\`${sha.slice(0, 7)}\`](${process.env.COMMIT_URL})`
      : `\`${sha.slice(0, 7)}\``
    : null;
  const lines = [
    '## ❌ Nightly compatibility run',
    '',
    '> [!CAUTION]',
    `> ${failedBlocking.length} blocking ${failedBlocking.length === 1 ? 'job' : 'jobs'} failed in the latest nightly run.`,
    '',
    '| | |',
    '| --- | --- |',
    `| Latest run | [**Open the run**](${runUrl}) |`,
    ...(commit ? [`| Commit | ${commit} |`] : []),
    `| Updated | ${new Date().toISOString()} |`,
    '',
    '### 🧪 Blocking',
    '',
    table(BLOCKING, true),
    '',
    '### 🧩 Not blocking',
    '',
    table(NON_BLOCKING, false),
    '',
  ];
  if (warned.length > 0) {
    lines.push(
      '> [!NOTE]',
      '> Not-blocking failures never open this issue. They are listed for information.',
      '',
    );
  }
  lines.push(
    '### 💡 Next',
    '',
    '- Open the failed job in the run, and reproduce it locally with `pnpm install --frozen-lockfile && pnpm test`.',
    '- This issue updates itself every night, and closes itself when the blocking jobs pass again.',
    '',
  );
  return lines.join('\n');
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
  const listArgs = [
    'issue',
    'list',
    '--label',
    LABEL,
    '--state',
    'open',
    '--json',
    'number',
    '--limit',
    '100',
  ];
  if (dryRun) {
    gh(listArgs);
    return Number.isInteger(simulatedExisting) ? simulatedExisting : null;
  }
  const numbers = JSON.parse(gh(listArgs) || '[]').map((i) => i.number);
  // If more than one is ever open, keep working on the oldest.
  return numbers.length > 0 ? Math.min(...numbers) : null;
}

function ensureLabel() {
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
}

const summary = BLOCKING.map(([key]) => `${key} ${results[key]}`).join(', ');
group('Nightly results');
console.log(`ℹ️ ${summary}`);
for (const [key] of NON_BLOCKING) console.log(`ℹ️ ${key} ${results[key]} (not blocking)`);
endGroup();

if (failedBlocking.length > 0) {
  const existing = findOpenIssue();
  if (existing === null) {
    ensureLabel();
    gh(['issue', 'create', '--title', TITLE, '--label', LABEL, '--body-file', '-'], issueBody());
    console.log(red('❌ A blocking job failed. Opened the nightly-failure issue.'));
  } else {
    gh(['issue', 'edit', String(existing), '--body-file', '-'], issueBody());
    gh(
      ['issue', 'comment', String(existing), '--body-file', '-'],
      `❌ Still failing in [the latest run](${runUrl}): ${failedBlocking.map(([key]) => `\`${key}\``).join(', ')}.\n`,
    );
    console.log(red(`❌ A blocking job failed. Updated issue #${existing}.`));
  }
} else if (allGreen) {
  const existing = findOpenIssue();
  if (existing === null) {
    console.log(green('✅ All blocking jobs passed and no nightly-failure issue is open.'));
  } else {
    gh(
      ['issue', 'comment', String(existing), '--body-file', '-'],
      `✅ All blocking jobs passed in [the latest run](${runUrl}). Closing this issue.\n`,
    );
    gh(['issue', 'close', String(existing), '--reason', 'completed']);
    console.log(green(`✅ All blocking jobs passed. Closed issue #${existing}.`));
  }
} else {
  console.log(
    yellow(
      '⚠️ A blocking job was cancelled or skipped, so the result is unknown. Left the issue as is.',
    ),
  );
}
