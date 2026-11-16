import { appendFileSync } from 'node:fs';

const useColor =
  !process.env.NO_COLOR && (process.stdout.isTTY || process.env.CI || process.env.GITHUB_ACTIONS);
const paint = (code) => (text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);

export const dim = paint(2);

const inActions = Boolean(process.env.GITHUB_ACTIONS);

export function group(title, fn) {
  if (inActions) console.log(`::group::${title}`);
  try {
    fn();
  } finally {
    if (inActions) console.log('::endgroup::');
  }
}

export function num(value, digits) {
  if (!Number.isFinite(value)) return 'n/a';
  if (digits !== undefined) return value.toFixed(digits);
  const abs = Math.abs(value);
  if (abs >= 100) return Math.round(value).toLocaleString('en-US');
  if (abs >= 10) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  return value.toPrecision(3);
}

export function ms(value) {
  if (!Number.isFinite(value)) return 'n/a';
  if (value >= 100) return Math.round(value).toLocaleString('en-US') + ' ms';
  if (value >= 1) return value.toFixed(2) + ' ms';
  if (value >= 0.001) return (value * 1000).toFixed(1) + ' µs';
  return (value * 1e6).toFixed(0) + ' ns';
}

export function ops(value) {
  if (!Number.isFinite(value)) return 'n/a';
  return Math.round(value).toLocaleString('en-US');
}

export function table(headers, rows) {
  const line = (cells) => '| ' + cells.join(' | ') + ' |';
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n');
}

export function writeSummary(markdown) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return false;
  appendFileSync(file, markdown + '\n');
  return true;
}
