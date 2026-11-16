// A stand-in for `npm` and `gh` in the script tests. It answers from the JSON file named by
// FAKE_RESPONSES: { "<tool> <args joined by spaces>": { out, err, code } }. A key ending in `*`
// matches by prefix. Every call is appended to FAKE_LOG. Unknown calls exit 1.
import { appendFileSync, readFileSync } from 'node:fs';

const line = `${process.env.FAKE_NAME} ${process.argv.slice(2).join(' ')}`;
if (process.env.FAKE_LOG) appendFileSync(process.env.FAKE_LOG, `${line}\n`);
interface Fake {
  out?: string;
  err?: string;
  code?: number;
}
const responses: Record<string, Fake> = JSON.parse(
  readFileSync(process.env.FAKE_RESPONSES as string, 'utf8'),
);
const key =
  line in responses
    ? line
    : Object.keys(responses).find((k) => k.endsWith('*') && line.startsWith(k.slice(0, -1)));
if (!key) {
  console.error(`no fake response for: ${line}`);
  process.exit(1);
}
const { out = '', err = '', code = 0 } = responses[key] as Fake;
if (out) process.stdout.write(`${out}\n`);
if (err) process.stderr.write(`${err}\n`);
process.exit(code);
