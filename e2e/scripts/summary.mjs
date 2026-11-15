// Turns the Playwright JSON report into a GitHub job summary: a verdict, then a table with one
// row per consumer. Usage: node scripts/summary.mjs <browser> [results.json]
import fs from 'node:fs';

const browser = process.argv[2] ?? 'browser';
const file = process.argv[3] ?? 'test-results/results.json';
const out = process.env.GITHUB_STEP_SUMMARY;

function write(text) {
  if (out) fs.appendFileSync(out, text);
  else process.stdout.write(text);
}

if (!fs.existsSync(file)) {
  write(
    `## 🧪 E2E on ${browser}\n\n> [!CAUTION]\n> No report was written, so the run stopped early.\n`,
  );
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const rows = new Map();

function visit(suite, trail) {
  const title = suite.title && !suite.title.endsWith('.ts') ? [...trail, suite.title] : trail;
  for (const spec of suite.specs ?? []) {
    const consumer = title[0] ?? 'unknown';
    const row = rows.get(consumer) ?? { passed: 0, failed: 0, failures: [] };
    const ok = spec.tests.every((t) => t.status === 'expected' || t.status === 'skipped');
    if (ok) row.passed++;
    else {
      row.failed++;
      row.failures.push(spec.title);
    }
    rows.set(consumer, row);
  }
  for (const child of suite.suites ?? []) visit(child, title);
}
for (const suite of report.suites ?? []) visit(suite, []);

const failed = [...rows.values()].reduce((sum, r) => sum + r.failed, 0);
const total = [...rows.values()].reduce((sum, r) => sum + r.passed + r.failed, 0);
const seconds = ((report.stats?.duration ?? 0) / 1000).toFixed(1);

let md = `## 🧪 E2E on ${browser}\n\n`;
md += failed
  ? `> [!CAUTION]\n> ${failed} of ${total} checks failed in ${browser}.\n\n`
  : `> [!TIP]\n> All ${total} checks passed in ${browser}.\n\n`;
md += `| Consumer | Result |\n| --- | --- |\n`;
for (const [consumer, row] of rows) {
  const result = row.failed
    ? `❌ ${row.failed} failed: ${row.failures.join(', ')}`
    : `✅ ${row.passed} passed`;
  md += `| ${consumer} | ${result} |\n`;
}
md += `\n| Fact | Value |\n| --- | --- |\n| Browser | **${browser}** |\n| Duration | ${seconds}s |\n`;
if (failed)
  md += `\n### 💡 Next\n\nDownload the \`playwright-${browser}\` artifact for the HTML report and traces.\n`;
write(md);
