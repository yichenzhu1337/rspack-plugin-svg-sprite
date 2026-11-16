import { describe, it, expect } from '@rstest/core';
import { run, script } from './helpers';

const NIGHTLY = script('ci', 'nightly-issue.mts');

type Status = 'success' | 'failure' | 'cancelled' | 'skipped';
function needs(blocking: Record<string, Status>, nonBlocking: Record<string, Status> = {}) {
  const jobs: Record<string, unknown> = {};
  for (const [key, result] of Object.entries(blocking)) jobs[key] = { result };
  // Non-blocking jobs publish their real status as an output.
  for (const [key, status] of Object.entries(nonBlocking)) {
    jobs[key] = { result: 'success', outputs: { status } };
  }
  return JSON.stringify(jobs);
}

const green = { test: 'success', 'next-ubuntu': 'success' } as const;

function nightly(json: string, args: string[] = []) {
  return run(NIGHTLY, ['--dry-run', ...args], {
    env: { NEEDS: json, RUN_URL: 'https://example.test/run/1', COMMIT_SHA: 'abcdef1234567' },
  });
}

describe('nightly-issue.mts --dry-run', () => {
  it('opens an issue, creating the label first, when a blocking job fails', () => {
    const result = nightly(needs({ ...green, test: 'failure' }));
    expect(result.code).toBe(0);
    expect(result.out).toContain('gh issue list --label nightly-failure --state open');
    expect(result.out).toContain('gh label create nightly-failure');
    expect(result.out).toContain('gh issue create --title');
    expect(result.out).toContain('1 blocking job failed');
    expect(result.out).toContain('`abcdef1`');
    expect(result.out).toContain('Opened the nightly-failure issue');
  });

  it('updates and comments on the open issue instead of opening another', () => {
    const result = nightly(needs({ ...green, 'next-ubuntu': 'failure' }), ['--existing', '42']);
    expect(result.out).toContain('gh issue edit 42');
    expect(result.out).toContain('gh issue comment 42');
    expect(result.out).not.toContain('gh issue create');
    expect(result.out).toContain('Updated issue #42');
  });

  it('closes the open issue when every blocking job passes', () => {
    const result = nightly(needs(green), ['--existing', '7']);
    expect(result.out).toContain('gh issue comment 7');
    expect(result.out).toContain('gh issue close 7 --reason completed');
    expect(result.out).toContain('Closed issue #7');
  });

  it('does nothing when green and no issue is open', () => {
    const result = nightly(needs(green));
    expect(result.out).toContain('no nightly-failure issue is open');
    expect(result.out).not.toContain('gh issue close');
    expect(result.out).not.toContain('gh issue create');
  });

  it('leaves the issue alone when a blocking job was cancelled or skipped', () => {
    for (const status of ['cancelled', 'skipped'] as const) {
      const result = nightly(needs({ ...green, test: status }), ['--existing', '7']);
      expect(result.out).toContain('Left the issue as is');
      expect(result.out).not.toContain('gh issue close');
      expect(result.out).not.toContain('gh issue edit');
    }
  });

  it('a failing job that is not blocking never opens the issue, but is listed when one opens', () => {
    const quiet = nightly(needs(green, { canary: 'failure' }));
    expect(quiet.out).not.toContain('gh issue create');
    expect(quiet.out).toContain('canary failure (not blocking)');
    const loud = nightly(needs({ ...green, test: 'failure' }, { canary: 'failure' }));
    expect(loud.out).toContain('Failed, not blocking');
    expect(loud.out).toContain('Not-blocking failures never open this issue');
  });

  it('fails clearly on bad input', () => {
    expect(nightly('not json').code).toBe(1);
    const noRun = run(NIGHTLY, ['--dry-run'], { env: { NEEDS: needs(green) } });
    expect(noRun.code).toBe(1);
    expect(noRun.out).toContain('RUN_URL is not set');
    const missing = nightly(JSON.stringify({ test: { result: 'success' } }));
    expect(missing.code).toBe(1);
    expect(missing.out).toContain('"next-ubuntu" is missing');
  });
});
