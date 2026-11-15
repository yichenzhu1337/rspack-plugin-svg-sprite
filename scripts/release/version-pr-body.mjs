#!/usr/bin/env node
// Prints the markdown body for the bot's "chore: version packages" pull request.
//
//   node scripts/release/version-pr-body.mjs [--ref <git-ref>]
//
// Reads package.json and CHANGELOG.md at <git-ref> (`git show <ref>:<file>`); without --ref it reads
// the working tree. Also asks npm for the current `latest`; if that fails the row says "unknown".
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { sectionOf } from '../lib/changelog.mjs';

const PKG = 'rspack-plugin-svg-sprite';
const REPO = 'https://github.com/yichenzhu1337/rspack-plugin-svg-sprite';
const RELEASE_WORKFLOW = `${REPO}/actions/workflows/release.yml`;

const args = process.argv.slice(2);
const refIndex = args.indexOf('--ref');
const ref = refIndex === -1 ? null : args[refIndex + 1];
if (refIndex !== -1 && !ref) {
  console.error('usage: version-pr-body.mjs [--ref <git-ref>]');
  process.exit(2);
}

const read = (file) =>
  ref
    ? execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8' })
    : readFileSync(file, 'utf8');

function npmLatest() {
  try {
    return (
      execFileSync('npm', ['view', PKG, 'version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() || null
    );
  } catch {
    return null;
  }
}

const version = JSON.parse(read('package.json')).version;
const latest = npmLatest();
const section = sectionOf(read('CHANGELOG.md'), version);

const out = [
  `## 🏷️ Version packages: ${version}`,
  '',
  '> [!NOTE]',
  '> Merging this pull request bumps the version and writes `CHANGELOG.md`. Nothing is published.',
  '',
  '| | |',
  '|---|---|',
  `| 📦 npm \`latest\` today | ${latest ?? 'unknown'} |`,
  `| 🏷️ After merging | **${version}** |`,
  '',
  '```diff',
  `- ${PKG} ${latest ?? 'unknown'}`,
  `+ ${PKG} ${version}`,
  '```',
  '',
  '### 📝 Changelog',
  '',
  section ?? '_No CHANGELOG.md section for this version._',
  '',
  '### 💡 Next: release after merging',
  '',
  `1. Merge this pull request.`,
  `2. Open [Actions ▸ Release](${RELEASE_WORKFLOW}) and run it with \`dry-run\`. It checks everything and publishes nothing.`,
  '3. Run it again with `publish`, then approve the `npm-release` environment.',
  '',
  '<sub>🤖 The release bot rewrites this pull request on every push to `main`, so edits made here are lost.</sub>',
];
process.stdout.write(out.join('\n') + '\n');
