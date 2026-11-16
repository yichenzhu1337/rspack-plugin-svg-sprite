// Checks the package exactly as npm users receive it.
//
//   node scripts/ci/package-check.mjs            build, pack and run every check
//   node scripts/ci/package-check.mjs --update   also rewrite scripts/ci/package-files.txt
//
// Checks: tarball file list vs snapshot, size budgets, TypeScript consumer fixtures
// (node16 CommonJS, node16 ESM, bundler) on TypeScript 5.0, 5.2, 5.3, 5.9 and 7 and the runtime smoke test of release.mjs.
//
// Env: PACKAGE_BUDGET_PACKED and PACKAGE_BUDGET_UNPACKED (bytes) override the budgets below.
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBudgets, lineDiff } from '../lib/package-diff.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SNAPSHOT = join(ROOT, 'scripts', 'ci', 'package-files.txt');
const FIXTURES = join(ROOT, 'scripts', 'ci', 'package-fixtures');
const RELEASE = join(ROOT, 'scripts', 'release', 'release.mjs');
// Compilers the consumer fixtures run against: the supported floor (5.0), 5.2 (the last
// release before import attributes parse), 5.3, the latest 5.x, and the repo's own
// TypeScript. All but the last are aliased devDependencies.
const COMPILERS = [
  { label: 'TypeScript 5.0 (floor)', pkg: 'typescript-5.0' },
  { label: 'TypeScript 5.2', pkg: 'typescript-5.2' },
  { label: 'TypeScript 5.3', pkg: 'typescript-5.3' },
  { label: 'TypeScript 5.9 (latest 5.x)', pkg: 'typescript-5.9' },
  { label: 'TypeScript 7', pkg: 'typescript' },
].map((c) => ({ ...c, bin: join(ROOT, 'node_modules', c.pkg, 'bin', 'tsc') }));

// Budgets in bytes, about 20% above the values measured when they were set
// (25,247 packed and 88,666 unpacked). Raise them on purpose, in a reviewed change.
const BUDGET = {
  packed: Number(process.env.PACKAGE_BUDGET_PACKED) || 50_000,
  unpacked: Number(process.env.PACKAGE_BUDGET_UNPACKED) || 180_000,
};

const update = process.argv.includes('--update');
const inActions = Boolean(process.env.GITHUB_ACTIONS);
const color = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.CI || inActions);
const paint = (code, text) => (color ? `\u001b[${code}m${text}\u001b[0m` : text);
const green = (t) => paint(32, t);
const red = (t) => paint(31, t);
const dim = (t) => paint(2, t);

const win = process.platform === 'win32';
function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: win && cmd !== process.execPath,
    ...options,
  });
}
function attempt(cmd, args, options) {
  try {
    return { ok: true, out: run(cmd, args, options).trim() };
  } catch (error) {
    return { ok: false, out: `${error.stdout ?? ''}${error.stderr ?? ''}`.trim() };
  }
}

const group = (title) => inActions && console.log(`::group::${title}`);
const endGroup = () => inActions && console.log('::endgroup::');
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

const results = []; // { check, ok, detail }
function record(check, ok, detail = '') {
  results.push({ check, ok, detail });
  console.log(`${ok ? green('✅') : red('❌')} ${check}${detail ? dim(` (${detail})`) : ''}`);
  if (!ok && inActions) console.log(`::error::❌ ${check}${detail ? ` (${detail})` : ''}`);
}

const work = mkdtempSync(join(tmpdir(), 'svg-sprite-package-check-'));
const sections = []; // markdown for the job summary

try {
  // 1. Build and pack.
  group('🏗️ Build and pack');
  const build = attempt('bun', ['run', 'build'], { cwd: ROOT });
  record('Build (bun run build)', build.ok);
  if (!build.ok) {
    console.log(build.out);
    throw new Error('build failed');
  }
  const packDir = join(work, 'pack');
  mkdirSync(packDir);
  const pack = attempt('npm', ['pack', '--json', '--pack-destination', packDir], { cwd: ROOT });
  if (!pack.ok) {
    console.log(pack.out);
    record('Pack (npm pack)', false);
    throw new Error('pack failed');
  }
  const info = JSON.parse(pack.out.slice(pack.out.indexOf('[')))[0];
  const tarball = join(packDir, info.filename);
  record('Pack (npm pack)', true, `${info.filename}, ${info.files.length} files`);
  endGroup();

  // 2. File list.
  group('🔍 Tarball file list');
  const actual = info.files.map((f) => f.path.replaceAll('\\', '/')).sort();
  if (update) {
    writeFileSync(SNAPSHOT, `${actual.join('\n')}\n`);
    console.log(`ℹ️ Rewrote ${SNAPSHOT}`);
  }
  const expected = existsSync(SNAPSHOT)
    ? readFileSync(SNAPSHOT, 'utf8').split(/\r?\n/).filter(Boolean).sort()
    : [];
  const diff = lineDiff(expected, actual);
  if (diff.length === 0) {
    record('File list matches package-files.txt', true, `${actual.length} files`);
  } else {
    record('File list matches package-files.txt', false, `${diff.length} differences`);
    const block = ['```diff', ...diff, '```'].join('\n');
    console.log(block);
    console.log(
      '💡 Intended change? Run `bun run check:package --update` and commit the snapshot.',
    );
    sections.push(
      `### 🔍 File list changed\n\n${block}\n\n💡 Run \`bun run check:package --update\` if intended.`,
    );
  }
  endGroup();

  // 3. Size budgets.
  group('📊 Size budgets');
  const sizeRows = [];
  for (const { label, value, budget, ok } of checkBudgets(info, BUDGET)) {
    sizeRows.push(`| ${label} | ${kb(value)} | ${kb(budget)} | ${ok ? '✅ Pass' : '❌ Over'} |`);
    record(
      `${label} size within budget`,
      ok,
      `${value.toLocaleString('en-US')} B of ${budget.toLocaleString('en-US')} B`,
    );
  }
  sections.push(
    `### 📊 Sizes\n\n| Size | Current | Budget | Result |\n| --- | --- | --- | --- |\n${sizeRows.join('\n')}`,
  );
  endGroup();

  // 4. Consumer fixtures.
  group('🧩 Consumer fixtures (tsc --noEmit)');
  for (const name of readdirSync(FIXTURES).sort()) {
    const dir = join(work, 'fixtures', name);
    cpSync(join(FIXTURES, name), dir, { recursive: true });
    const install = attempt(
      'npm',
      ['install', '--no-audit', '--no-fund', '--loglevel=error', tarball],
      { cwd: dir },
    );
    if (!install.ok) {
      record(`Fixture ${name}`, false, 'npm install failed');
      console.log(install.out);
      continue;
    }
    for (const { label, bin } of COMPILERS) {
      const tsc = attempt(process.execPath, [bin, '-p', 'tsconfig.json'], { cwd: dir });
      record(`Fixture ${name} on ${label}`, tsc.ok, tsc.ok ? 'tsc --noEmit' : 'type errors');
      if (!tsc.ok) console.log(tsc.out);
    }
  }
  endGroup();

  // 5. Runtime smoke test.
  group('🧪 Runtime smoke test');
  const smoke = attempt(process.execPath, [RELEASE, 'smoke', tarball], { cwd: ROOT });
  record('Runtime smoke test (release.mjs smoke)', smoke.ok);
  if (smoke.out) console.log(smoke.out);
  endGroup();
} catch (error) {
  console.log(red(`❌ ${error.message}`));
  if (!results.some((r) => !r.ok)) record(error.message, false);
} finally {
  rmSync(work, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
const verdict = failed.length
  ? `> [!CAUTION]\n> ❌ ${failed.length} of ${results.length} package checks failed.`
  : `> [!TIP]\n> ✅ All ${results.length} package checks passed.`;
const table = results.map((r) => `| ${r.check} | ${r.ok ? '✅ Pass' : '❌ Fail'} |`).join('\n');
const summary = `## 📦 Package check\n\n${verdict}\n\n| Check | Result |\n| --- | --- |\n${table}\n\n${sections.join('\n\n')}\n`;
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);

console.log(
  failed.length
    ? red(`\n❌ ${failed.length} of ${results.length} checks failed`)
    : green(`\n✅ All ${results.length} checks passed`),
);
process.exit(failed.length ? 1 : 0);
