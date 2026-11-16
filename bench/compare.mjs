#!/usr/bin/env node
// Compares two benchmark result files.
//
//   node compare.mjs <base.json> <head.json> [--fail-on-regression]
//
// Env: BENCH_REGRESSION_THRESHOLD (percent, default 15).
// Report-only by default: the exit code is 0 unless --fail-on-regression is passed.
import { readFileSync } from 'node:fs';
import { dim, group, ms, table, writeSummary } from './lib/format.mjs';

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith('--'));
const failOnRegression = args.includes('--fail-on-regression');
if (files.length !== 2) {
  console.error('Usage: node compare.mjs <base.json> <head.json> [--fail-on-regression]');
  process.exit(2);
}
const threshold = Number(process.env.BENCH_REGRESSION_THRESHOLD ?? 15);
if (!Number.isFinite(threshold) || threshold < 0) {
  console.error('❌ BENCH_REGRESSION_THRESHOLD must be a non-negative number of percent.');
  process.exit(2);
}

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const base = read(files[0]);
const head = read(files[1]);
const baseByName = new Map(base.results.map((r) => [r.name, r]));

const rows = [];
let regressions = 0;
let improvements = 0;
let compared = 0;
const added = [];
for (const h of head.results) {
  const b = baseByName.get(h.name);
  if (!b) {
    added.push(h.name);
    continue;
  }
  baseByName.delete(h.name);
  compared++;
  const change = (h.ms / b.ms - 1) * 100;
  const sign = change > 0 ? '+' : '';
  let cell = `${sign}${change.toFixed(1)}%`;
  if (change > threshold) {
    regressions++;
    cell = `⚠️ ${cell}`;
  } else if (change < -threshold) {
    improvements++;
    cell = `✅ ${cell}`;
  }
  rows.push([h.name, `${ms(b.ms)}`, `${ms(h.ms)}`, cell]);
}
const removed = [...baseByName.keys()];

let md = '## 📊 Benchmark comparison\n\n';
if (regressions > 0) {
  md += `> [!WARNING]\n> ${regressions} of ${compared} benchmarks are more than ${threshold}% slower. This check only reports; shared runners are noisy.\n\n`;
} else {
  md += `> [!TIP]\n> No benchmark is more than ${threshold}% slower than the base (${compared} compared).\n\n`;
}
md += table(
  ['Fact', 'Value'],
  [
    ['Compared', `**${compared}**`],
    ['Threshold', `${threshold}%`],
    ['Slower', String(regressions)],
    ['Faster', String(improvements)],
  ],
);
md += '\n\n### 🔍 Per benchmark\n\n' + table(['Benchmark', 'Base', 'Head', 'Change'], rows) + '\n';
if (added.length || removed.length) {
  md += `\n<details><summary>📄 ${added.length} added, ${removed.length} removed</summary>\n\n`;
  md += [...added.map((n) => `- added: ${n}`), ...removed.map((n) => `- removed: ${n}`)].join('\n');
  md += '\n\n</details>\n';
}

group('Benchmark comparison', () => console.log(md));
if (writeSummary(md)) console.log(dim('ℹ️ Wrote the job summary.'));
if (regressions > 0) {
  console.log(`⚠️ ${regressions} regression(s) above ${threshold}%.`);
  if (failOnRegression) process.exit(1);
} else {
  console.log('✅ No regressions above the threshold.');
}
