// Tiny output helpers shared by the CI and release scripts. No dependencies.
//
// Colors only when stdout is a TTY or CI/GITHUB_ACTIONS is set, and never when NO_COLOR is set.
// Groups (`::group::`) only when GITHUB_ACTIONS is set.
import { appendFileSync } from 'node:fs';

const env = process.env;
export const colorEnabled = () =>
  !env.NO_COLOR && Boolean(process.stdout.isTTY || env.CI || env.GITHUB_ACTIONS);

const paint = (code: number, reset: number) => (text: string) =>
  colorEnabled() ? `\u001b[${code}m${text}\u001b[${reset}m` : `${text}`;
export const green = paint(32, 39);
export const red = paint(31, 39);
export const yellow = paint(33, 39);
export const dim = paint(2, 22);
export const bold = paint(1, 22);

// Status lines: a leading emoji, a color, then the message.
export const ok = (text: string) => console.log(`✅ ${green(text)}`);
export const fail = (text: string) => console.log(`❌ ${red(text)}`);
export const warn = (text: string) => console.log(`⚠️ ${yellow(text)}`);
export const info = (text: string) => console.log(`ℹ️ ${text}`);
export const detail = (text: string) => console.log(dim(text));

// Collapsible log section on GitHub Actions; a plain heading elsewhere.
export function group<T>(title: string, body: () => T): T {
  if (env.GITHUB_ACTIONS) console.log(`::group::${title}`);
  else console.log(bold(title));
  try {
    return body();
  } finally {
    if (env.GITHUB_ACTIONS) console.log('::endgroup::');
  }
}

// Append markdown to the job summary, when there is one.
export const summary = (text: string) =>
  env.GITHUB_STEP_SUMMARY && appendFileSync(env.GITHUB_STEP_SUMMARY, text.replace(/\n*$/, '\n'));

// A markdown table from a header row and body rows.
export const table = (header: string[], rows: string[][]) =>
  [
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---').join('|')}|`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');

// A collapsible markdown block.
export const details = (title: string, content: string) =>
  `<details><summary>${title}</summary>\n\n${content}\n\n</details>`;
