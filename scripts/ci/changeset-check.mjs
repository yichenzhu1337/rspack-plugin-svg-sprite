#!/usr/bin/env node
// Pull request check: changes to the published package need a changeset.
//
// Needs one: src/ outside src/__tests__/, client.d.ts, and package.json fields other than
// devDependencies, scripts, packageManager and version.
// Exempt: everything else (docs, CI, tests, examples), the version PR (branch changeset-release/*),
// and pull requests labelled `no-changeset`.
// Also validates every changeset the PR adds.
//
// Env: BASE_SHA (PR base commit), HEAD_REF (PR branch), LABELS (JSON array of label names).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fail, group, info, ok, summary } from '../lib/output.mjs';

const PKG = 'rspack-plugin-svg-sprite';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const lines = (text) => text.split('\n').filter(Boolean);

const base = process.env.BASE_SHA;
const headRef = process.env.HEAD_REF || '';
const labels = JSON.parse(process.env.LABELS || '[]');
if (!base) throw new Error('BASE_SHA is not set');

const changed = lines(git('diff', '--name-only', `${base}...HEAD`));
const added = lines(git('diff', '--name-only', '--diff-filter=A', `${base}...HEAD`));
const changesets = added.filter(
  (f) => /^\.changeset\/[^/]+\.md$/.test(f) && f !== '.changeset/README.md',
);

const problems = [];
for (const file of changesets) {
  const match = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    problems.push(`${file}: missing the --- front matter block`);
    continue;
  }
  const entries = lines(match[1]);
  if (!entries.length) problems.push(`${file}: names no package`);
  for (const entry of entries) {
    if (!new RegExp(`^["']?${PKG}["']?:\\s*(patch|minor|major)\\s*$`).test(entry.trim())) {
      problems.push(`${file}: expected "${PKG}": patch | minor | major, found "${entry.trim()}"`);
    }
  }
  if (!match[2].trim()) problems.push(`${file}: the summary for users is empty`);
}

const reasons = changed.filter(
  (f) => (f.startsWith('src/') && !f.startsWith('src/__tests__/')) || f === 'client.d.ts',
);
if (changed.includes('package.json')) {
  const published = (json) => {
    const pkg = JSON.parse(json);
    for (const key of ['devDependencies', 'scripts', 'packageManager', 'version']) delete pkg[key];
    return JSON.stringify(pkg);
  };
  if (
    published(git('show', `${base}:package.json`)) !==
    published(readFileSync('package.json', 'utf8'))
  ) {
    reasons.push('package.json (published fields)');
  }
}

let exemption = null;
let note = null;
if (headRef.startsWith('changeset-release/')) {
  exemption = 'Version PR';
} else if (labels.includes('no-changeset')) {
  exemption = 'Labelled `no-changeset`';
} else if (reasons.length && !changesets.length) {
  problems.push(
    `this PR changes the published package (${reasons.join(', ')}) but adds no changeset. ` +
      'Run `pnpm changeset`, commit the file, and push. For a change that should not be released, ' +
      'add the `no-changeset` label.',
  );
} else {
  note = changesets.length
    ? `Changesets: ${changesets.join(', ')}`
    : 'No published files changed: no changeset needed.';
}

const bullets = (items) => items.map((f) => `- \`${f}\``).join('\n');
const facts = [
  '| Fact | Value |',
  '|---|---|',
  `| 🔍 Files changed | ${changed.length} |`,
  `| 📦 Published files touched | ${reasons.length ? reasons.map((r) => `\`${r}\``).join(', ') : 'none'} |`,
  `| 📝 Changesets added | ${changesets.length} |`,
];
const failure = [];
group('Changeset check', () => {
  info(`${changed.length} file(s) changed, ${reasons.length} touching the published package`);
  if (exemption) ok(`${exemption}: exempt`);
  else if (note) ok(note);
  for (const problem of problems) console.log(`::error::❌ ${problem}`);
});

if (problems.length) {
  failure.push(
    '## 📝 Changeset check',
    '',
    '> [!CAUTION]',
    `> ${problems.length} problem(s) with the changeset for this pull request.`,
    '',
    ...facts,
    '',
    ...problems.map((p) => `- ❌ ${p}`),
    '',
    '### 🛠️ How to fix',
    '',
    '1. Run `pnpm changeset` and pick `patch`, `minor` or `major`.',
    '2. Commit the new file in `.changeset/` and push.',
    '3. Or, for a change that should not be released, add the `no-changeset` label.',
  );
  summary(failure.join('\n'));
  fail('changeset check failed');
  process.exit(1);
}
summary(
  [
    '## 📝 Changeset check',
    '',
    '> [!TIP]',
    exemption ? `> ${exemption}: exempt from the changeset check.` : `> ${note}`,
    '',
    ...facts,
    ...(changesets.length ? ['', bullets(changesets)] : []),
  ].join('\n'),
);
ok('changeset check passed');
