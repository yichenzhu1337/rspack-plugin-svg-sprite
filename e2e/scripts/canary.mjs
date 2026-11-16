// Downstream canary: builds a real open-source project that uses `svg-sprite-loader`, first as it
// is (the baseline), then with this checkout's packed tarball swapped in, and compares the sprite
// symbols the two builds emitted (ids and viewBoxes, found in the output bundle or sprite file).
// The projects, their pinned commits and the swap patches live in e2e/canaries.mjs.
//
// Usage: node scripts/canary.mjs [--project <name>] [--tarball <file>] [--keep] [--list]
//        (--project may repeat; without --tarball the checkout is built and packed first;
//         --keep leaves the work directory in place; --list prints the project names as JSON)
// Exit code: 0 when every project matches (or has a documented `expectedDiff`), 1 otherwise.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { canaries } from '../canaries.mjs';
import { PACKAGE, packPackage, run } from './lib.mjs';

const args = process.argv.slice(2);
const flagValues = (name) =>
  args.flatMap((arg, i) => (arg === name && args[i + 1] ? [args[i + 1]] : []));

if (args.includes('--list')) {
  console.log(JSON.stringify(canaries.map((c) => c.name)));
  process.exit(0);
}

const useColor =
  !process.env.NO_COLOR && (process.stdout.isTTY || process.env.GITHUB_ACTIONS === 'true');
const paint = (code) => (text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);
const green = paint(32);
const red = paint(31);
const yellow = paint(33);
const dim = paint(2);

function listFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(full));
    else found.push(full);
  }
  return found;
}

/**
 * Every `<symbol ... id="...">` in the build output: sprite files, HTML and JS bundles (where the
 * markup sits inside a string, so quotes may be backslash-escaped). Returns id -> viewBox.
 */
function collectSymbols(dir) {
  const symbols = new Map();
  for (const file of listFiles(dir)) {
    if (!/\.(svg|html|js|mjs|cjs)$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const [, tag] of text.matchAll(/<symbol\b([^>]*)>/g)) {
      const id = /\bid=\\?["']([^"'\\]+)/.exec(tag)?.[1];
      if (!id) continue;
      symbols.set(id, /\bviewBox=\\?["']([^"'\\]+)/.exec(tag)?.[1] ?? '');
    }
  }
  return symbols;
}

/** Applies one project's patches, and swaps the dependency in package.json. */
function swapIn(canary, dir, tarball) {
  const pkgPath = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  let removed = false;
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    if (pkg[field]?.['svg-sprite-loader']) {
      delete pkg[field]['svg-sprite-loader'];
      removed = true;
    }
  }
  if (!removed) throw new Error(`${canary.name}: package.json no longer lists svg-sprite-loader`);
  pkg.devDependencies = { ...pkg.devDependencies, [PACKAGE]: `file:${tarball}` };
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  for (const { file, from, to } of canary.patches) {
    const target = path.join(dir, file);
    const text = fs.readFileSync(target, 'utf8');
    const count = text.split(from).length - 1;
    if (count !== 1) {
      throw new Error(`${canary.name}: expected "${from}" once in ${file}, found ${count}`);
    }
    fs.writeFileSync(
      target,
      text.replace(from, () => to),
    );
  }
}

async function checkout(canary, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const url = `https://github.com/${canary.repo}.git`;
  await run('git', ['init', '-q'], dir, 'git init');
  await run('git', ['fetch', '-q', '--depth', '1', url, canary.sha], dir, 'git fetch');
  await run('git', ['checkout', '-q', 'FETCH_HEAD'], dir, 'git checkout');
}

async function runCanary(canary, tarball, workDir) {
  const dir = path.join(workDir, canary.name);
  const say = (message) => console.log(`${dim(`[${canary.name}]`)} ${message}`);

  say(`fetching ${canary.repo}@${canary.sha.slice(0, 10)}`);
  await checkout(canary, dir);
  say('installing the project as it is');
  await run(canary.install[0], canary.install.slice(1), dir, `${canary.name}: install`);
  say('building the baseline (svg-sprite-loader)');
  const env = { CI: 'true' };
  await run(canary.build[0], canary.build.slice(1), dir, `${canary.name}: baseline build`, env);
  const out = path.join(dir, canary.outDir);
  if (!fs.existsSync(out))
    throw new Error(`${canary.name}: the baseline build wrote no ${canary.outDir}/`);
  const baseline = collectSymbols(out);
  if (baseline.size === 0) throw new Error(`${canary.name}: the baseline build has no symbols`);
  fs.renameSync(out, `${out}-baseline`);

  say('swapping in the packed tarball');
  swapIn(canary, dir, tarball);
  // Only the dependency changed; the project's lockfile stays out of the way of the new install.
  const swapInstall = canary.swapInstall ?? ['npm', 'install', '--no-audit', '--no-fund'];
  await run(swapInstall[0], swapInstall.slice(1), dir, `${canary.name}: install after the swap`);
  if (fs.existsSync(path.join(dir, 'node_modules', 'svg-sprite-loader/package.json'))) {
    say(
      yellow(
        'svg-sprite-loader is still installed (a transitive dependency); the config no longer uses it',
      ),
    );
  }
  say('building with rspack-plugin-svg-sprite');
  await run(canary.build[0], canary.build.slice(1), dir, `${canary.name}: swapped build`, env);
  if (!fs.existsSync(out))
    throw new Error(`${canary.name}: the swapped build wrote no ${canary.outDir}/`);
  const swapped = collectSymbols(out);

  const missing = [...baseline.keys()].filter((id) => !swapped.has(id));
  const added = [...swapped.keys()].filter((id) => !baseline.has(id));
  const changed = [...baseline.keys()].filter(
    (id) => swapped.has(id) && swapped.get(id) !== baseline.get(id),
  );
  return { baseline: baseline.size, swapped: swapped.size, missing, added, changed };
}

const wanted = flagValues('--project');
const unknown = wanted.filter((name) => !canaries.some((c) => c.name === name));
if (unknown.length > 0) {
  console.error(red(`Unknown project: ${unknown.join(', ')}`));
  process.exit(1);
}
const selected = canaries.filter((c) => wanted.length === 0 || wanted.includes(c.name));

const workDir = fs.mkdtempSync(path.join(process.env.CANARY_WORKDIR || os.tmpdir(), 'svg-canary-'));
let exitCode = 0;
try {
  const tarball =
    flagValues('--tarball')[0] !== undefined
      ? path.resolve(flagValues('--tarball')[0])
      : await packPackage(path.join(workDir, 'pack'));
  console.log(dim(`Package: ${tarball}`));

  const rows = [];
  for (const canary of selected) {
    try {
      const result = await runCanary(canary, tarball, workDir);
      const differs = result.missing.length + result.added.length + result.changed.length > 0;
      const ok = !differs || Boolean(canary.expectedDiff);
      rows.push({ canary, result, ok, differs });
    } catch (error) {
      rows.push({ canary, error, ok: false });
    }
  }

  console.log('\n## Downstream canaries\n');
  console.log('| Project | Baseline symbols | Swapped symbols | Result |');
  console.log('| --- | --- | --- | --- |');
  for (const { canary, result, error, ok, differs } of rows) {
    const verdict = error
      ? '❌ error'
      : !differs
        ? '✅ same'
        : ok
          ? '⚠️ expected difference'
          : '❌ differs';
    console.log(
      `| ${canary.name} (${canary.repo}@${canary.sha.slice(0, 7)}) | ${result?.baseline ?? '-'} | ${result?.swapped ?? '-'} | ${verdict} |`,
    );
  }
  for (const { canary, result, error, ok } of rows) {
    if (error) {
      console.log(`\n${red(`❌ ${canary.name}`)}\n${error.message}`);
    } else if (result.missing.length + result.added.length + result.changed.length > 0) {
      console.log(
        `\n${ok ? yellow(`⚠️ ${canary.name}: ${canary.expectedDiff}`) : red(`❌ ${canary.name}`)}`,
      );
      for (const id of result.missing) console.log(`  missing after the swap: ${id}`);
      for (const id of result.added) console.log(`  new after the swap: ${id}`);
      for (const id of result.changed) console.log(`  viewBox changed: ${id}`);
    }
  }
  if (rows.some((row) => !row.ok)) exitCode = 1;
  console.log(
    exitCode === 0
      ? green('\n✅ Every project builds the same symbols.')
      : red('\n❌ A canary failed.'),
  );
} finally {
  if (args.includes('--keep')) console.log(dim(`Kept ${workDir}`));
  else fs.rmSync(workDir, { recursive: true, force: true });
}
process.exit(exitCode);
