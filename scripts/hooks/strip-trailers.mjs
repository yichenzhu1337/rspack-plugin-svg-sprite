// commit-msg hook: strips co-author and "made with" trailers so commits are attributed to the
// committer only. Usage: node scripts/hooks/strip-trailers.mjs <commit-message-file>
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const kept = lines.filter((line) => !/^(co-authored-by|made-with):/i.test(line));
  if (kept.length !== lines.length) writeFileSync(file, kept.join('\n'));
}
