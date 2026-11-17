import { describe, it, expect } from '@rstest/core';
import { git, commit, makeRepo, run, script, write } from './helpers';

const SCAN = script('ci', 'privacy-scan.sh');
const SECRET = 'bananaphone';

function scan(options: {
  change?: Record<string, string>;
  message?: string;
  title?: string;
  body?: string;
  deny?: string | undefined;
}) {
  const { dir, base } = makeRepo({ 'a.txt': 'one\ntwo\n' });
  commit(dir, options.change ?? { 'b.txt': 'clean\n' }, options.message ?? 'a clean message');
  const env: Record<string, string> = {
    BASE_SHA: base,
    PR_TITLE: options.title ?? 'fix: a clean title',
    PR_BODY: options.body ?? 'A clean description.',
  };
  if (options.deny !== undefined) env.DENY = options.deny;
  const result = run(SCAN, [], { cwd: dir, env, bash: true });
  return { dir, ...result };
}

describe('privacy-scan.sh', () => {
  it('passes when nothing matches', () => {
    const result = scan({ deny: SECRET });
    expect(result.code).toBe(0);
    expect(result.out).toContain('privacy scan passed');
    expect(result.summary).toContain('No personal information found');
  });

  it('fails without the secret and says so', () => {
    const result = scan({});
    expect(result.code).toBe(1);
    expect(result.out).toContain('PERSONAL_GUARD_DENY secret is not set');
    expect(result.summary).toContain('nothing was scanned');
  });

  it('fails on an empty secret too', () => {
    expect(scan({ deny: '' }).code).toBe(1);
  });

  it('fails on a match in the PR title', () => {
    const result = scan({ deny: SECRET, title: `fix: ${SECRET} thing` });
    expect(result.code).toBe(1);
    expect(result.out).toContain('match in the PR title');
  });

  it('fails on a match in the PR description', () => {
    const result = scan({ deny: SECRET, body: `see ${SECRET}` });
    expect(result.code).toBe(1);
    expect(result.out).toContain('match in the PR description');
  });

  it('fails on a match in a commit message', () => {
    const result = scan({ deny: SECRET, message: `mention of ${SECRET}` });
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/match in commit [0-9a-f]{8} \(message\)/);
  });

  it('fails on a match in the commit author', () => {
    const result = scan({ deny: 'author@example', message: 'fine' });
    expect(result.code).toBe(1);
    expect(result.out).toContain('(author or committer)');
  });

  it('fails on a match in an added line and names the file and line', () => {
    const result = scan({ deny: SECRET, change: { 'src/x.ts': `ok\nconst a = '${SECRET}';\n` } });
    expect(result.code).toBe(1);
    expect(result.out).toContain('match in src/x.ts:2');
  });

  it('scans an added line that starts with "++ " and names the right file and line', () => {
    const result = scan({
      deny: SECRET,
      change: { 'src/x.ts': `ok\n++ ${SECRET} here\n`, 'src/y.ts': 'fine\n' },
    });
    expect(result.code).toBe(1);
    expect(result.out).toContain('match in src/x.ts:2');
    expect(result.out).not.toContain(SECRET);
  });

  it('does not flag a removed or untouched line', () => {
    const { dir, base } = makeRepo({ 'a.txt': `${SECRET}\nkeep\n` });
    write(dir, 'a.txt', 'keep\nextra\n');
    git(dir, 'commit', '-q', '-am', 'drop it');
    const result = run(SCAN, [], {
      cwd: dir,
      env: { BASE_SHA: base, DENY: SECRET, PR_TITLE: 't', PR_BODY: 'b' },
      bash: true,
    });
    expect(result.code).toBe(0);
  });

  it('matches case-insensitively', () => {
    expect(scan({ deny: SECRET, title: `fix: ${SECRET.toUpperCase()}` }).code).toBe(1);
  });

  it('never prints the matched text, in the log or the summary', () => {
    const result = scan({
      deny: SECRET,
      title: `${SECRET} title`,
      body: `${SECRET} body`,
      message: `${SECRET} commit`,
      change: { 'src/x.ts': `${SECRET}\n` },
    });
    expect(result.code).toBe(1);
    expect(result.out).not.toContain(SECRET);
    expect(result.summary).not.toContain(SECRET);
    expect(result.summary).toContain('The matched text is not shown');
  });

  it('counts commits and added lines', () => {
    const result = scan({ deny: SECRET, change: { 'b.txt': '1\n2\n3\n' } });
    expect(result.out).toContain('1 commit(s) and 3 added line(s)');
  });
});
