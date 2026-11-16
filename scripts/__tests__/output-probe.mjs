// Exercises scripts/lib/output.mjs from a child process, so colors and groups can be tested
// under different environments.
import { detail, fail, group, info, ok, summary, warn } from '../lib/output.mjs';

group('Group title', () => {
  ok('fine');
  fail('broken');
  warn('careful');
  info('note');
  detail('quiet');
});
summary('line one');
