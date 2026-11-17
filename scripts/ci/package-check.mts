// Checks the package exactly as npm users receive it.
//
//   node scripts/ci/package-check.mts            build, pack and run every check
//   node scripts/ci/package-check.mts --update   also rewrite scripts/ci/package-files.txt
//
// Checks: tarball file list vs snapshot, size budgets, TypeScript consumer fixtures
// (node16 CommonJS, node16 ESM, bundler) on TypeScript 5.0, 5.2, 5.3, 5.9 and 7 and the runtime smoke test of release.mts.
//
// Env: PACKAGE_BUDGET_PACKED and PACKAGE_BUDGET_UNPACKED (bytes) override the budgets below.
import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptions } from 'node:child_process';

type RunOptions = Omit<ExecFileSyncOptions, 'encoding'>;
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
import { checkBudgets, lineDiff } from '../lib/package-diff.mts';

interface PackInfo {
  filename: string;
  files: { path: string }[];
  size: number;
  unpackedSize: number;
}

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SNAPSHOT = join(ROOT, 'scripts', 'ci', 'package-files.txt');
const FIXTURES = join(ROOT, 'scripts', 'ci', 'package-fixtures');
const OWN_DECLARATIONS = 'node_modules/rspack-plugin-svg-sprite/';
const RELEASE = join(ROOT, 'scripts', 'release', 'release.mts');
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
  // Raised for 1.7.0 (50,140 / 179,005 measured: three features, and CHANGELOG.md ships in the tarball).
  packed: Number(process.env.PACKAGE_BUDGET_PACKED) || 55_000,
  unpacked: Number(process.env.PACKAGE_BUDGET_UNPACKED) || 195_000,
};

const update = process.argv.includes('--update');
const inActions = Boolean(process.env.GITHUB_ACTIONS);
const color = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.CI || inActions);
const paint = (code: number, text: string) => (color ? `\u001b[${code}m${text}\u001b[0m` : text);
const green = (t: string) => paint(32, t);
const red = (t: string) => paint(31, t);
const dim = (t: string) => paint(2, t);

const win = process.platform === 'win32';
function run(cmd: string, args: string[], options: RunOptions = {}): string {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: win && cmd !== process.execPath,
    ...options,
  });
}
function attempt(cmd: string, args: string[], options?: RunOptions) {
  try {
    return { ok: true, out: run(cmd, args, options).trim() };
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: string; stderr?: string };
    return { ok: false, out: `${stdout ?? ''}${stderr ?? ''}`.trim() };
  }
}

const group = (title: string) => inActions && console.log(`::group::${title}`);
const endGroup = () => inActions && console.log('::endgroup::');
const kb = (n: number) => `${(n / 1024).toFixed(1)} kB`;

const results: { check: string; ok: boolean; detail: string }[] = [];
function record(check: string, ok: boolean, detail = '') {
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
  const info: PackInfo = JSON.parse(pack.out.slice(pack.out.indexOf('[')))[0];
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
    for (const { label, bin, pkg } of COMPILERS) {
      // TypeScript 7 removed esModuleInterop=false and allowSyntheticDefaultImports=false.
      if (name.endsWith('-strict') && pkg === 'typescript') continue;
      const tsc = attempt(process.execPath, [bin, '-p', 'tsconfig.json'], { cwd: dir });
      // The `-strict` fixtures turn skipLibCheck off, so third-party declarations (Rsbuild's
      // bundled ones need @types/node) report errors that are not ours: keep only the fixture's
      // own and this package's.
      const errors = name.endsWith('-strict')
        ? tsc.out
            .split('\n')
            .filter((l) => /error TS\d+/.test(l))
            .filter((l) => !l.startsWith('node_modules/') || l.startsWith(OWN_DECLARATIONS))
        : tsc.ok
          ? []
          : [tsc.out];
      const ok = errors.length === 0;
      record(`Fixture ${name} on ${label}`, ok, ok ? 'tsc --noEmit' : 'type errors');
      if (!ok) console.log(errors.join('\n'));
    }
  }
  endGroup();

  // 5. Runtime smoke test.
  group('🧪 Runtime smoke test');
  const smoke = attempt(process.execPath, [RELEASE, 'smoke', tarball], { cwd: ROOT });
  record('Runtime smoke test (release.mts smoke)', smoke.ok);
  if (smoke.out) console.log(smoke.out);
  endGroup();
} catch (error) {
  const { message } = error as Error;
  console.log(red(`❌ ${message}`));
  if (!results.some((r) => !r.ok)) record(message, false);
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
