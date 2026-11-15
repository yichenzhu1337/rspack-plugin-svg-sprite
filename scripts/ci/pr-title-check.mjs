#!/usr/bin/env node
// Pull request check: the title must be a Conventional Commit. Pull requests are squash-merged,
// so the title becomes the commit subject on main.
//
//   <type>[(<scope>)][!]: <description>
//
// Env: PR_TITLE.
import { appendFileSync } from 'node:fs';

const TYPES = {
  feat: 'a new feature',
  fix: 'a bug fix',
  perf: 'a performance improvement',
  refactor: 'a code change that neither fixes a bug nor adds a feature',
  docs: 'documentation only',
  test: 'tests only',
  build: 'the build or dependencies',
  ci: 'CI workflows and scripts',
  chore: 'anything else that does not touch the published package',
  revert: 'reverts an earlier commit',
  style: 'formatting only',
};
const MAX_LENGTH = 100;

const title = process.env.PR_TITLE ?? '';
const problems = [];
const match = title.match(/^(\w+)(?:\(([^()]*)\))?(!)?: (.*)$/);
// GitHub's Revert button titles its pull requests `Revert "<original title>"`.
const githubRevert = /^Revert ".+"$/.test(title);

if (githubRevert) {
  // accepted as is
} else if (!match) {
  problems.push('it does not match `<type>[(<scope>)][!]: <description>`');
} else {
  const [, type, scope, , description] = match;
  if (!(type in TYPES)) problems.push(`\`${type}\` is not a known type`);
  if (scope !== undefined && !/^[a-z0-9][a-z0-9-]*$/.test(scope)) {
    problems.push('the scope must be lowercase letters, digits and hyphens');
  }
  if (!description.trim()) problems.push('the description is empty');
  else if (description !== description.trim()) {
    problems.push('the description has extra spaces at its start or end');
  }
  if (/\.$/.test(description.trim())) problems.push('the description ends with a period');
}
if (title.length > MAX_LENGTH) {
  problems.push(`it is ${title.length} characters long; keep it to ${MAX_LENGTH}`);
}

const summary = (text) =>
  process.env.GITHUB_STEP_SUMMARY && appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');

if (problems.length) {
  for (const problem of problems) console.log(`::error::PR title: ${problem}`);
  summary(
    [
      '### PR title',
      '',
      `\`${title.replace(/`/g, "'")}\` is not a Conventional Commit title:`,
      '',
      ...problems.map((p) => `- ${p}`),
      '',
      'Use `<type>[(<scope>)][!]: <description>`, for example `fix: keep every icon in watch mode`',
      'or `feat(loader)!: drop the include option`. GitHub revert titles (`Revert "…"`) are',
      'accepted too. Types:',
      '',
      ...Object.entries(TYPES).map(([type, meaning]) => `- \`${type}\`: ${meaning}`),
      '',
      'Edit the title; this check re-runs on its own.',
    ].join('\n'),
  );
  process.exit(1);
}
console.log(`PR title ok: ${title}`);
summary(`### PR title\n\n\`${title.replace(/`/g, "'")}\` is a valid Conventional Commit title.`);
