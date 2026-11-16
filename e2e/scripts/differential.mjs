// Differential test: builds every consumer twice, once with a published version from npm (the
// baseline, `latest` by default) and once with the candidate (the packed tarball of this
// checkout), then compares what each build emitted:
//   - every .svg file in the output (the extracted sprites)
//   - the { id, viewBox, url, content } of each icon module, read by running the built bundle
// A difference fails the run unless e2e/differential-allow.json lists it. Each entry is
// { consumer (a name or "*"), icon or file, reason, since (version) }.
//
// Usage: node scripts/differential.mjs [--baseline <version|dist-tag>] [--keep]
//        (env: DIFF_BASELINE; --keep leaves the built apps in a temp directory)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { consumers, initialIcons, lateIcon } from '../consumers.mjs';
import { PACKAGE, buildConsumer, e2eDir, packPackage, resolveVersion } from './lib.mjs';

const flag = process.argv.indexOf('--baseline');
const baselineSpec = (flag >= 0 && process.argv[flag + 1]) || process.env.DIFF_BASELINE || 'latest';
const allowList = JSON.parse(fs.readFileSync(path.join(e2eDir, 'differential-allow.json'), 'utf8'));
const icons = [...initialIcons, lateIcon];

const useColor =
  !process.env.NO_COLOR && (process.stdout.isTTY || process.env.GITHUB_ACTIONS === 'true');
const paint = (code) => (text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);
const green = paint(32);
const red = paint(31);
const yellow = paint(33);
const dim = paint(2);

function listFiles(dir, ext) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(full, ext));
    else if (entry.name.endsWith(ext)) found.push(full);
  }
  return found;
}

/** Runs the built bundle without a DOM and reads back what the probe entry published. */
function readIcons(dist) {
  const scripts = listFiles(dist, '.js')
    .filter((file) => !file.endsWith('.map'))
    // Entry chunk last: shared chunks must register first.
    .sort(
      (a, b) =>
        Number(/index|main|app/.test(path.basename(a))) -
          Number(/index|main|app/.test(path.basename(b))) || a.localeCompare(b),
    );
  const context = vm.createContext({ console });
  context.self = context.window = context.globalThis = context;
  for (const file of scripts)
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  if (typeof context.__probe !== 'string')
    throw new Error(`the bundle in ${dist} published no icons`);
  return JSON.parse(context.__probe);
}

function collect(dist) {
  const sprites = Object.fromEntries(
    listFiles(dist, '.svg')
      .sort()
      .map((file) => [path.relative(dist, file), fs.readFileSync(file, 'utf8')]),
  );
  return { sprites, icons: readIcons(dist) };
}

function unifiedDiff(label, before, after, scratch) {
  const a = path.join(scratch, 'a');
  const b = path.join(scratch, 'b');
  fs.writeFileSync(a, before.endsWith('\n') ? before : `${before}\n`);
  fs.writeFileSync(b, after.endsWith('\n') ? after : `${after}\n`);
  const result = spawnSync(
    'diff',
    ['-u', '--label', `baseline ${label}`, '--label', `candidate ${label}`, a, b],
    {
      encoding: 'utf8',
    },
  );
  return result.stdout.trimEnd();
}

function allowed(consumer, kind, key) {
  return allowList.find(
    (entry) =>
      (entry.consumer === consumer || entry.consumer === '*') &&
      (kind === 'icon' ? entry.icon === key : entry.file === key),
  );
}

async function buildAll(side, options, root) {
  // A failed build is a result too (an old baseline may lack an entry point), not a crash.
  return Promise.all(
    consumers.map((c) =>
      buildConsumer(c, path.join(root, `${c.name}-${side}`), options).catch((error) => ({ error })),
    ),
  );
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-sprite-diff-'));
const started = Date.now();
try {
  console.log(`ℹ️ Packing the candidate`);
  const tarball = await packPackage(path.join(root, 'pack'));
  console.log(
    `ℹ️ Building ${consumers.length} consumers with ${PACKAGE}@${baselineSpec} and with the candidate`,
  );
  const base = await buildAll(
    'base',
    { spec: await resolveVersion(baselineSpec), probe: icons },
    root,
  );
  const cand = await buildAll('cand', { spec: `file:${tarball}`, probe: icons }, root);
  const versionsOf = (builds) =>
    [...new Set(builds.map((b) => b.installed).filter(Boolean))].join(', ');
  const baselineVersion = versionsOf(base) || baselineSpec;
  const candidateVersion = versionsOf(cand) || 'candidate';

  const rows = [];
  const blocks = [];
  let failures = 0;
  consumers.forEach((consumer, i) => {
    const broken = [
      ['baseline', base[i]],
      ['candidate', cand[i]],
    ].find(([, b]) => b.error);
    if (broken) {
      failures++;
      const message = broken[1].error.message.split('\n')[0];
      rows.push({
        consumer: consumer.name,
        sprites: '-',
        icons: '-',
        blocking: 1,
        note: `❌ ${broken[0]} build failed`,
      });
      blocks.push({ title: `${consumer.name}: ${broken[0]} build failed`, text: message });
      return;
    }
    const before = collect(base[i].dist);
    const after = collect(cand[i].dist);
    const diffs = [];
    const scratch = fs.mkdtempSync(path.join(root, 'cmp-'));

    for (const file of new Set([...Object.keys(before.sprites), ...Object.keys(after.sprites)])) {
      const b = before.sprites[file] ?? '';
      const a = after.sprites[file] ?? '';
      if (b !== a) diffs.push({ kind: 'file', key: file, text: unifiedDiff(file, b, a, scratch) });
    }
    for (const icon of icons) {
      const b = JSON.stringify(before.icons[icon], null, 2) ?? '';
      const a = JSON.stringify(after.icons[icon], null, 2) ?? '';
      if (b !== a) diffs.push({ kind: 'icon', key: icon, text: unifiedDiff(icon, b, a, scratch) });
    }

    const blocking = diffs.filter((d) => !allowed(consumer.name, d.kind, d.key));
    const permitted = diffs.filter((d) => allowed(consumer.name, d.kind, d.key));
    failures += blocking.length;
    rows.push({
      consumer: consumer.name,
      sprites: Object.keys(after.sprites).length,
      icons: icons.length,
      blocking: blocking.length,
      permitted: permitted.length,
    });
    for (const d of diffs) {
      const entry = allowed(consumer.name, d.kind, d.key);
      blocks.push({
        title: `${consumer.name}: ${d.kind} ${d.key}${entry ? ` (allowed: ${entry.reason})` : ''}`,
        text: d.text,
      });
    }
  });

  const result = (r) =>
    r.note ??
    (r.blocking
      ? `❌ ${r.blocking} differ`
      : r.permitted
        ? `⚠️ ${r.permitted} allowed`
        : '✅ Same');
  console.log('');
  console.log(`| Consumer | Sprite files | Icons | Result |`);
  console.log(`| --- | --- | --- | --- |`);
  for (const r of rows) console.log(`| ${r.consumer} | ${r.sprites} | ${r.icons} | ${result(r)} |`);
  for (const block of blocks) {
    if (process.env.GITHUB_ACTIONS) console.log(`::group::${block.title}`);
    else console.log(`\n${block.title}`);
    console.log(block.text);
    if (process.env.GITHUB_ACTIONS) console.log('::endgroup::');
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const verdict = failures
    ? red(
        `❌ ${failures} difference${failures === 1 ? '' : 's'} between ${PACKAGE}@${baselineVersion} and the candidate.`,
      )
    : green(
        `✅ The candidate (${candidateVersion}) matches ${PACKAGE}@${baselineVersion} in every consumer.`,
      );
  console.log(`\n${verdict} ${dim(`(${seconds}s)`)}`);
  if (blocks.length && !failures) console.log(yellow('⚠️ Some differences are on the allow-list.'));

  if (process.env.GITHUB_STEP_SUMMARY) {
    let md = `## 🔍 Differential test\n\n`;
    md += failures
      ? `> [!CAUTION]\n> ${failures} difference${failures === 1 ? '' : 's'} from the published \`${baselineVersion}\`.\n\n`
      : `> [!TIP]\n> The candidate matches the published \`${baselineVersion}\` in every consumer.\n\n`;
    md += `| Consumer | Sprite files | Icons | Result |\n| --- | --- | --- | --- |\n`;
    for (const r of rows) md += `| ${r.consumer} | ${r.sprites} | ${r.icons} | ${result(r)} |\n`;
    md += `\n| Fact | Value |\n| --- | --- |\n| Baseline | **${baselineVersion}** |\n| Candidate | **${candidateVersion}** |\n| Duration | ${seconds}s |\n`;
    for (const block of blocks) {
      md += `\n<details><summary>📄 ${block.title}</summary>\n\n\`\`\`diff\n${block.text}\n\`\`\`\n\n</details>\n`;
    }
    if (failures) {
      md += `\n### 💡 Next\n\nFix the output, or list a deliberate change in \`e2e/differential-allow.json\` with a reason.\n`;
    }
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  }
  process.exitCode = failures ? 1 : 0;
} finally {
  if (process.argv.includes('--keep')) console.log(`ℹ️ Kept the builds in ${root}`);
  else fs.rmSync(root, { recursive: true, force: true });
}
