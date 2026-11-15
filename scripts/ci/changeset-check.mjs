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
import { appendFileSync, readFileSync } from 'node:fs';

const PKG = 'rspack-plugin-svg-sprite';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const lines = (text) => text.split('\n').filter(Boolean);
const summary = (text) =>
  process.env.GITHUB_STEP_SUMMARY && appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');

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

summary('### Changeset check');
if (headRef.startsWith('changeset-release/')) {
  summary('Version PR: exempt.');
} else if (labels.includes('no-changeset')) {
  summary('Labelled `no-changeset`: exempt.');
} else if (reasons.length && !changesets.length) {
  problems.push(
    `this PR changes the published package (${reasons.join(', ')}) but adds no changeset. ` +
      'Run `pnpm changeset`, commit the file, and push. For a change that should not be released, ' +
      'add the `no-changeset` label.',
  );
} else {
  summary(
    changesets.length
      ? `Changesets: ${changesets.join(', ')}`
      : 'No published files changed: no changeset needed.',
  );
}

if (problems.length) {
  for (const problem of problems) console.log(`::error::${problem}`);
  summary(problems.map((p) => `- ❌ ${p}`).join('\n'));
  process.exit(1);
}
console.log('changeset check passed');
