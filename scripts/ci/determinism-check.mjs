#!/usr/bin/env node
// Builds and packs the same commit twice, each in its own clean copy, and requires the two
// tarballs to be byte-identical. A mismatch lists the files whose content differs.
//
//   node scripts/ci/determinism-check.mjs
//
// Each copy holds the tracked files of the working tree (plus untracked, non-ignored ones), gets its
// own `bun install --frozen-lockfile`, `bun run build` and `npm pack`.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { differingFiles } from '../lib/package-diff.mjs';
import { detail, fail, info, ok, summary, table } from '../lib/output.mjs';

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

// { path: sha256 } of every file inside a tarball.
function tarballContents(tarball, dir) {
  mkdirSync(dir, { recursive: true });
  run('tar', ['-xzf', tarball, '-C', dir]);
  const hashes = {};
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else hashes[full.slice(dir.length + 1)] = sha256(readFileSync(full));
    }
  };
  walk(dir);
  return hashes;
}

async function buildCopy(root, label, work) {
  const copy = join(work, label);
  mkdirSync(copy);
  const files = run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean);
  for (const file of files) {
    await cp(join(root, file), join(copy, file), { recursive: true, force: true });
  }
  run('bun', ['install', '--frozen-lockfile'], { cwd: copy });
  run('bun', ['run', 'build'], { cwd: copy });
  const out = join(copy, '.pack');
  mkdirSync(out);
  run('npm', ['pack', '--pack-destination', out], { cwd: copy });
  const [name] = readdirSync(out);
  return join(out, name);
}

async function main() {
  const root = resolve(process.cwd());
  const work = mkdtempSync(join(tmpdir(), 'svg-sprite-determinism-'));
  try {
    if (process.env.GITHUB_ACTIONS) console.log('::group::Build and pack twice');
    const first = await buildCopy(root, 'first', work);
    const second = await buildCopy(root, 'second', work);
    if (process.env.GITHUB_ACTIONS) console.log('::endgroup::');
    const hashes = [sha256(readFileSync(first)), sha256(readFileSync(second))];
    console.log(`first  sha256 ${hashes[0]}`);
    console.log(`second sha256 ${hashes[1]}`);
    if (hashes[0] === hashes[1]) {
      ok('both builds produced byte-identical tarballs');
      summary(
        [
          '## 🏗️ Build determinism',
          '',
          '> [!TIP]',
          '> Two clean builds of this commit produced byte-identical tarballs.',
          '',
          table(
            ['Build', 'sha256'],
            [
              ['First', `\`${hashes[0]}\``],
              ['Second', `\`${hashes[1]}\``],
            ],
          ),
        ].join('\n'),
      );
      return 0;
    }
    const differing = differingFiles(
      tarballContents(first, join(work, 'first-files')),
      tarballContents(second, join(work, 'second-files')),
    );
    fail('the two builds produced different tarballs');
    for (const name of differing) detail(`differs: ${name}`);
    if (!differing.length) info('every file is identical, so only the archive metadata differs');
    console.log(`::error::❌ The build is not deterministic: ${differing.length} file(s) differ`);
    summary(
      [
        '## 🏗️ Build determinism',
        '',
        '> [!CAUTION]',
        '> Two clean builds of this commit produced different tarballs.',
        '',
        table(
          ['Build', 'sha256'],
          [
            ['First', `\`${hashes[0]}\``],
            ['Second', `\`${hashes[1]}\``],
          ],
        ),
        '',
        '### 🔍 Files that differ',
        '',
        differing.length
          ? differing.map((f) => `- \`${f}\``).join('\n')
          : '_Only archive metadata differs._',
      ].join('\n'),
    );
    return 1;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main());
}
