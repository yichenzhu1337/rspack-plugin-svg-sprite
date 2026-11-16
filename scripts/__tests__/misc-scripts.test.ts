import { describe, it, expect } from '@rstest/core';
import { commit, fakeTools, makeRepo, run, script } from './helpers';
import { sectionOf } from '../lib/changelog.mts';
import { details, table } from '../lib/output.mts';
import { checkBudgets, differingFiles, lineDiff } from '../lib/package-diff.mts';
import { compare, isPrerelease, nextRc, parse } from '../lib/semver.mts';
import { integrityProblems } from '../lib/verify.mts';

const PKG = 'rspack-plugin-svg-sprite';

describe('lib/changelog', () => {
  const text = '# x\n\n## 1.0.1\n\n- b\n\n## 1.0.0\n\n- a\n';
  it('returns one section without its heading', () => {
    expect(sectionOf(text, '1.0.1')).toBe('- b');
    expect(sectionOf(text, '1.0.0')).toBe('- a');
  });
  it('returns null for a missing version, and treats the version as text', () => {
    expect(sectionOf(text, '2.0.0')).toBeNull();
    expect(sectionOf(text, '1.0.')).toBeNull();
    expect(sectionOf(text, '1.*')).toBeNull();
  });
  it('reads CRLF files', () => {
    expect(sectionOf('## 1.0.0\r\n\r\n- a\r\n', '1.0.0')).toBe('- a');
  });
});

describe('lib/output', () => {
  it('builds a table and a details block', () => {
    expect(table(['A', 'B'], [['1', '2']])).toBe('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(details('title', 'body')).toBe(
      '<details><summary>title</summary>\n\nbody\n\n</details>',
    );
  });

  it('prints status lines without color under NO_COLOR and appends to the job summary', () => {
    const tools = fakeTools({});
    const file = script('__tests__', 'output-probe.mts');
    const result = run(file, [], { bin: tools.dir });
    expect(result.out).toContain('✅ fine');
    expect(result.out).toContain('❌ broken');
    expect(result.out).toContain('⚠️ careful');
    expect(result.out).toContain('ℹ️ note');
    expect(result.out).not.toContain('\u001b[');
    expect(result.out).not.toContain('::group::');
    expect(result.summary).toBe('line one\n');
  });

  it('colors in CI and wraps groups on GitHub Actions, unless NO_COLOR is set', () => {
    const file = script('__tests__', 'output-probe.mts');
    const colored = run(file, [], { env: { NO_COLOR: '', CI: 'true', GITHUB_ACTIONS: 'true' } });
    expect(colored.out).toContain('\u001b[32m');
    expect(colored.out).toContain('::group::Group title');
    expect(colored.out).toContain('::endgroup::');
    const plain = run(file, [], { env: { NO_COLOR: '1', CI: 'true' } });
    expect(plain.out).not.toContain('\u001b[');
  });
});

describe('lib/semver', () => {
  it('parses versions and rejects other text', () => {
    expect(parse('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, pre: null });
    expect(parse('1.2.3-rc.4')?.pre).toBe('rc.4');
    expect(parse('latest')).toBeNull();
    expect(isPrerelease('1.2.3-rc.1')).toBe(true);
    expect(isPrerelease('1.2.3')).toBe(false);
    expect(isPrerelease('nope')).toBe(false);
  });

  it('orders versions, with a release after its own prereleases', () => {
    const ordered = ['1.2.3-rc.1', '1.2.3-rc.2', '1.2.3', '1.2.4', '1.10.0', '2.0.0'];
    for (let i = 1; i < ordered.length; i++) {
      expect(compare(ordered[i - 1], ordered[i])).toBeLessThan(0);
      expect(compare(ordered[i], ordered[i - 1])).toBeGreaterThan(0);
    }
    expect(compare('1.2.3', '1.2.3')).toBe(0);
    expect(compare('1.2.3-rc.1', '1.2.3-rc.1')).toBe(0);
  });

  it('picks the next free release candidate number', () => {
    expect(nextRc('1.2.3', [])).toBe('1.2.3-rc.1');
    expect(nextRc('1.2.3', ['1.2.3-rc.1', '1.2.3-rc.4', '1.2.3-rc.x', '1.2.4-rc.9'])).toBe(
      '1.2.3-rc.5',
    );
    expect(nextRc('1.2.3-rc.2', ['1.2.3-rc.2'])).toBe('1.2.3-rc.3');
  });
});

describe('lib/package-diff', () => {
  it('lists removed and added files, sorted by name', () => {
    expect(lineDiff(['a', 'b', 'c'], ['b', 'c', 'd', '0'])).toEqual(['+ 0', '- a', '+ d']);
    expect(lineDiff(['a'], ['a'])).toEqual([]);
  });

  it('flags a size over budget and passes a size within it', () => {
    const rows = checkBudgets({ size: 100, unpackedSize: 500 }, { packed: 100, unpacked: 499 });
    expect(rows.map((r) => [r.label, r.ok])).toEqual([
      ['Packed', true],
      ['Unpacked', false],
    ]);
    expect(rows[1].budget).toBe(499);
  });

  it('finds files that differ or exist on one side only', () => {
    expect(differingFiles({ a: '1', b: '2', c: '3' }, { a: '1', b: 'x', d: '4' })).toEqual([
      'b',
      'c',
      'd',
    ]);
    expect(differingFiles({ a: '1' }, { a: '1' })).toEqual([]);
  });
});

describe('lib/verify', () => {
  it('reports each value that differs and ignores values that are not expected', () => {
    expect(integrityProblems({}, { integrity: 'x', shasum: 'y' })).toEqual([]);
    expect(
      integrityProblems({ integrity: 'a', shasum: 'b' }, { integrity: 'a', shasum: 'b' }),
    ).toEqual([]);
    const problems = integrityProblems(
      { integrity: 'a', shasum: 'b' },
      { integrity: '', shasum: 'c' },
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('(empty)');
  });
});

describe('version-pr-body.mts', () => {
  const BODY = script('release', 'version-pr-body.mts');
  const files = {
    'package.json': JSON.stringify({ name: PKG, version: '1.2.3' }),
    'CHANGELOG.md': '## 1.2.3\n\n- Fixed a thing.\n\n## 1.2.2\n\n- Old.\n',
  };

  it('prints the changelog section and the npm latest', () => {
    const { dir } = makeRepo(files);
    const tools = fakeTools({ [`npm view ${PKG} version`]: { out: '1.2.2' } });
    const result = run(BODY, [], { cwd: dir, bin: tools.dir });
    expect(result.code).toBe(0);
    expect(result.out).toContain('Version packages: 1.2.3');
    expect(result.out).toContain('| 📦 npm `latest` today | 1.2.2 |');
    expect(result.out).toContain('- Fixed a thing.');
    expect(result.out).not.toContain('- Old.');
    expect(result.out).toContain(`+ ${PKG} 1.2.3`);
  });

  it('says unknown when npm cannot be reached, and when the section is missing', () => {
    const { dir } = makeRepo({ ...files, 'CHANGELOG.md': '## 0.0.1\n' });
    const tools = fakeTools({ [`npm view ${PKG} version`]: { code: 1 } });
    const result = run(BODY, [], { cwd: dir, bin: tools.dir });
    expect(result.out).toContain('| 📦 npm `latest` today | unknown |');
    expect(result.out).toContain('No CHANGELOG.md section for this version');
  });

  it('reads the files at a git ref with --ref', () => {
    const { dir } = makeRepo(files);
    commit(dir, { 'package.json': JSON.stringify({ name: PKG, version: '9.9.9' }) });
    const tools = fakeTools({ [`npm view ${PKG} version`]: { out: '1.2.2' } });
    const old = run(BODY, ['--ref', 'HEAD~1'], { cwd: dir, bin: tools.dir });
    expect(old.out).toContain('Version packages: 1.2.3');
    const now = run(BODY, [], { cwd: dir, bin: tools.dir });
    expect(now.out).toContain('Version packages: 9.9.9');
  });

  it('exits 2 when --ref has no value', () => {
    const { dir } = makeRepo(files);
    expect(run(BODY, ['--ref'], { cwd: dir }).code).toBe(2);
  });
});
