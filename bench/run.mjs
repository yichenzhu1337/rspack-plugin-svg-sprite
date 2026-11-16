#!/usr/bin/env node
// Benchmarks for rspack-plugin-svg-sprite, run against the compiled dist/ like a consumer.
//
//   node run.mjs [--out results.json] [--no-summary]
//
// Env: BENCH_DIST (dist directory, default ../dist), BENCH_SKIP_BUILDS=1 (skip real builds),
//      BENCH_OUT (same as --out), BENCH_BUILD_RUNS (builds per case, default 5),
//      BENCH_ICONS (icons in the real build project, default 1000).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Bench } from 'tinybench';
import { withCodSpeed } from '@codspeed/tinybench-plugin';
import { runBuildBenchmarks } from './lib/builds.mjs';
import { generatedIcon, largeIcon, manyAttrsIcon, repoIcons, smallIcon } from './lib/fixtures.mjs';
import { dim, group, ms, num, ops, table, writeSummary } from './lib/format.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(process.env.BENCH_DIST || join(here, '..', 'dist'));
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outFile = resolve(
  outIndex >= 0
    ? args[outIndex + 1]
    : process.env.BENCH_OUT || join(here, 'results', 'latest.json'),
);

const loaderModule = require(join(dist, 'loader.js'));
const loader = loaderModule.default;
const NAMESPACE = loaderModule.NAMESPACE || 'rspack-plugin-svg-sprite';
const pluginModule = require(join(dist, 'plugin.js'));
const SvgSpritePlugin = pluginModule.default;
const { parseRootTag, legacy, parseViewBox, extractSvgInner, extractSvgAttrs } = loaderModule;

function makeContext(resourcePath, options, sink) {
  return {
    resourcePath,
    getOptions: () => options,
    cacheable() {},
    emitWarning() {},
    _module: { type: 'javascript/auto' },
    _compiler: { options: { output: { publicPath: '/assets/' } } },
    _compilation: { [NAMESPACE]: { addSymbol: (s) => sink.push(s) } },
  };
}

/** Collected results. `units` is how many icons or symbols one task call processes. */
const results = [];

async function runGroup(name, cases, { time = 1000, warmupTime = 300 } = {}) {
  const bench = withCodSpeed(new Bench({ time, warmupTime, iterations: 16, warmupIterations: 8 }));
  const meta = new Map();
  for (const c of cases) {
    bench.add(c.name, c.fn);
    meta.set(c.name, c);
  }
  await bench.run();
  for (const task of bench.tasks) {
    const r = task.result;
    if (!r || r.state === 'errored') {
      throw new Error(
        'Benchmark failed: ' + task.name + (r && r.error ? ': ' + r.error.message : ''),
      );
    }
    if (!r.latency) continue; // instrumented runs (CodSpeed) report no statistics
    const c = meta.get(task.name);
    const perUnit = r.latency.p50 / c.units;
    results.push({
      group: name,
      name: task.name,
      unit: c.unitName,
      units: c.units,
      ms: perUnit,
      opsPerSec: 1000 / perUnit,
      rme: r.latency.rme,
      samples: r.latency.samples ?? r.latency.sampleCount ?? null,
    });
  }
}

const repo = repoIcons();
const synthetic = [
  ['small icon', smallIcon()],
  ['large multi-path icon', largeIcon()],
  ['icon with many attributes', manyAttrsIcon()],
];
const loaderInputs = [
  [`repo icons (${repo.length})`, repo.map((i) => ({ path: i.file, content: i.content }))],
  ...synthetic.map(([label, content]) => [label, [{ path: '/icons/sample.svg', content }]]),
];
const parseInputs = loaderInputs.map(([label, items]) => [label, items.map((i) => i.content)]);

// 1. Loader throughput.
const loaderCases = [];
for (const mode of ['inline', 'extract']) {
  const options = mode === 'extract' ? { extract: true, spriteFilename: 'sprite.svg' } : {};
  for (const [label, items] of loaderInputs) {
    const sink = [];
    loaderCases.push({
      name: `loader ${mode}: ${label}`,
      unitName: 'icon',
      units: items.length,
      fn() {
        sink.length = 0;
        for (const item of items) loader.call(makeContext(item.path, options, sink), item.content);
      },
    });
  }
}
await runGroup('Loader throughput', loaderCases);

// 2. Root tag parsing, new parser against the v1 regex helpers.
const parseCases = [];
for (const [label, contents] of parseInputs) {
  if (typeof parseRootTag === 'function') {
    parseCases.push({
      name: `parseRootTag: ${label}`,
      unitName: 'icon',
      units: contents.length,
      fn() {
        for (const c of contents) parseRootTag(c);
      },
    });
  }
  if (legacy) {
    parseCases.push({
      name: `legacy helpers: ${label}`,
      unitName: 'icon',
      units: contents.length,
      fn() {
        for (const c of contents) {
          legacy.parseViewBox(c);
          legacy.extractSvgInner(c);
          legacy.extractSvgAttrs(c);
        }
      },
    });
  }
  if (typeof parseViewBox === 'function') {
    parseCases.push({
      name: `viewBox + inner + attrs: ${label}`,
      unitName: 'icon',
      units: contents.length,
      fn() {
        for (const c of contents) {
          parseViewBox(c);
          extractSvgInner(c);
          extractSvgAttrs(c);
        }
      },
    });
  }
}
await runGroup('Root tag parsing', parseCases);

// 3. Plugin: sprite generation and symbol registration.
const pluginCases = [];
for (const count of [100, 1000, 3000]) {
  const symbols = Array.from({ length: count }, (_, i) => {
    const id = 'icon-' + String(i).padStart(5, '0');
    return {
      id,
      viewBox: '0 0 24 24',
      content: `<symbol id="${id}" viewBox="0 0 24 24">${generatedIcon(i)}</symbol>`,
      resourcePath: `/icons/${id}.svg`,
      spriteFilename: 'sprite.svg',
    };
  });
  const plugin = new SvgSpritePlugin();
  pluginCases.push({
    name: `generateSprite: ${count} symbols`,
    unitName: 'symbol',
    units: count,
    fn() {
      plugin.generateSprite(symbols);
    },
  });
  pluginCases.push({
    name: `addSymbol: ${count} symbols`,
    unitName: 'symbol',
    units: count,
    fn() {
      const fresh = new SvgSpritePlugin();
      for (const s of symbols) fresh.addSymbol(s);
    },
  });
}
await runGroup('Plugin', pluginCases, { time: 1000 });

// 4. Real builds.
if (!process.env.BENCH_SKIP_BUILDS) {
  results.push(...(await runBuildBenchmarks({ dist, here })));
}

const output = {
  meta: {
    date: new Date().toISOString(),
    node: process.version,
    platform: process.platform + ' ' + process.arch,
    cpu: (cpus()[0] && cpus()[0].model.trim()) || 'unknown',
    cpus: cpus().length,
  },
  results,
};
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(output, null, 2) + '\n');

// Markdown report.
const groups = [...new Set(results.map((r) => r.group))];
let md = '## 📊 Benchmarks\n\n';
md += '> [!NOTE]\n> Medians per icon or symbol, measured against the compiled `dist/`.\n\n';
md += table(
  ['Fact', 'Value'],
  [
    ['Benchmarks', `**${results.length}**`],
    ['Node', output.meta.node],
    ['Runner', `${output.meta.cpus} x ${output.meta.cpu}`],
  ],
);
md += '\n';
for (const g of groups) {
  const rows = results
    .filter((r) => r.group === g)
    .map((r) => [
      r.name,
      ops(r.opsPerSec) + ' /s',
      ms(r.ms) + ' per ' + r.unit,
      '±' + num(r.rme, 1) + '%',
    ]);
  md +=
    `\n### ${emojiFor(g)} ${g}\n\n` +
    table(['Benchmark', 'Throughput', 'Time', 'Error'], rows) +
    '\n';
}

function emojiFor(g) {
  return (
    { 'Loader throughput': '🔍', 'Root tag parsing': '🧩', Plugin: '📦', 'Real builds': '🏗️' }[g] ||
    '📊'
  );
}

group('Benchmark results', () => {
  console.log(md);
});
if (!args.includes('--no-summary') && writeSummary(md)) {
  console.log(dim('ℹ️ Wrote the job summary.'));
}
console.log(`✅ ${results.length} benchmarks done. Results: ${outFile}`);
