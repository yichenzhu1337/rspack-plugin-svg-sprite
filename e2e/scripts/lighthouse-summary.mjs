// Writes the median Lighthouse scores of each audited page to the GitHub job summary.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const file = '.lighthouseci/manifest.json';
if (existsSync(file) && process.env.GITHUB_STEP_SUMMARY) {
  const rows = JSON.parse(readFileSync(file, 'utf8')).filter((r) => r.isRepresentativeRun);
  const pct = (n) => Math.round(n * 100);
  const out = [
    '### 🔦 Lighthouse (median of 3 runs)',
    '',
    '| Page | Performance | Accessibility | Best practices | SEO |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const r of rows) {
    const s = r.summary;
    out.push(
      `| ${new URL(r.url).pathname} | ${pct(s.performance)} | ${pct(s.accessibility)} | ${pct(s['best-practices'])} | ${pct(s.seo)} |`,
    );
  }
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, out.join('\n') + '\n');
}
