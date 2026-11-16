import { describe, it, expect } from '@rstest/core';
import { fakeTools, run, script } from './helpers';
import {
  checklist,
  deprecationMessage,
  parseArgs,
  pickGoodVersion,
  plan,
} from '../release/rollback.mts';

const ROLLBACK = script('release', 'rollback.mts');
const PKG = 'rspack-plugin-svg-sprite';
const VERSIONS = ['1.5.0', '1.6.0', '1.6.1-rc.1', '1.6.1', '1.6.2', '1.7.0-rc.1'];
const registry = (extra = {}) =>
  fakeTools({ [`npm view ${PKG} versions --json`]: { out: JSON.stringify(VERSIONS) }, ...extra });

describe('rollback.mts helpers', () => {
  it('picks the highest release below the bad version, skipping prereleases', () => {
    expect(pickGoodVersion('1.6.2', VERSIONS)).toBe('1.6.1');
    expect(pickGoodVersion('1.6.1', VERSIONS)).toBe('1.6.0');
    expect(pickGoodVersion('1.5.0', VERSIONS)).toBeNull();
    expect(pickGoodVersion('1.6.2', ['1.6.2', 'junk'])).toBeNull();
  });

  it('plans the two npm commands and a checklist', () => {
    expect(plan('1.6.2', '1.6.0')).toEqual([
      ['dist-tag', 'add', `${PKG}@1.6.0`, 'latest'],
      ['deprecate', `${PKG}@1.6.2`, deprecationMessage('1.6.2', '1.6.0')],
    ]);
    expect(checklist('1.6.2', '1.6.0').join('\n')).toContain('Fix forward');
  });

  it('parses arguments', () => {
    expect(parseArgs(['1.6.2', '--to', '1.6.0', '--execute'])).toEqual({
      bad: '1.6.2',
      to: '1.6.0',
      execute: true,
    });
    expect(parseArgs([]).execute).toBe(false);
    expect(() => parseArgs(['1.6.2', '1.6.1'])).toThrow('unexpected argument');
  });
});

describe('rollback.mts', () => {
  it('prints a dry run by default and runs nothing', () => {
    const tools = registry();
    const result = run(ROLLBACK, ['1.6.2', '--to', '1.6.0'], { bin: tools.dir });
    expect(result.code).toBe(0);
    expect(result.out).toContain(`npm dist-tag add ${PKG}@1.6.0 latest`);
    expect(result.out).toContain(`npm deprecate ${PKG}@1.6.2 "1.6.2 has a defect`);
    expect(result.out).toContain('Dry run');
    expect(result.out).toContain('Nothing was changed');
    expect(tools.calls()).toEqual([`npm view ${PKG} versions --json`]);
  });

  it('defaults the good version to the highest release below the bad one', () => {
    const result = run(ROLLBACK, ['1.6.2'], { bin: registry().dir });
    expect(result.out).toContain(`dist-tag add ${PKG}@1.6.1 latest`);
  });

  it('with --execute runs the dist-tag command, then the deprecation', () => {
    const tools = registry({
      [`npm dist-tag add ${PKG}@1.6.0 latest`]: { out: '+latest: ' },
      [`npm deprecate ${PKG}@1.6.2 *`]: {},
    });
    const result = run(ROLLBACK, ['1.6.2', '--to', '1.6.0', '--execute'], { bin: tools.dir });
    expect(result.code).toBe(0);
    expect(tools.calls().slice(1)).toEqual([
      `npm dist-tag add ${PKG}@1.6.0 latest`,
      `npm deprecate ${PKG}@1.6.2 1.6.2 has a defect and was rolled back. Use 1.6.0 instead.`,
    ]);
  });

  it('stops at the first failing npm command', () => {
    const tools = registry({ [`npm dist-tag add ${PKG}@1.6.0 latest`]: { code: 1, err: 'E401' } });
    const result = run(ROLLBACK, ['1.6.2', '--to', '1.6.0', '--execute'], { bin: tools.dir });
    expect(result.code).toBe(1);
    expect(result.out).toContain('failed. Fix the cause');
    expect(tools.calls().some((c) => c.startsWith('npm deprecate'))).toBe(false);
  });

  it('refuses a bad version that is not published, or a good one that is not', () => {
    const unknown = run(ROLLBACK, ['9.9.9'], { bin: registry().dir });
    expect(unknown.code).toBe(1);
    expect(unknown.out).toContain('is not published');
    const missingGood = run(ROLLBACK, ['1.6.2', '--to', '1.0.0'], { bin: registry().dir });
    expect(missingGood.code).toBe(1);
    const same = run(ROLLBACK, ['1.6.2', '--to', '1.6.2'], { bin: registry().dir });
    expect(same.code).toBe(1);
  });

  it('asks for --to when nothing lower is published', () => {
    const result = run(ROLLBACK, ['1.5.0'], { bin: registry().dir });
    expect(result.code).toBe(1);
    expect(result.out).toContain('pass --to <version>');
  });

  it('exits 2 on bad usage and 1 when npm cannot be read', () => {
    expect(run(ROLLBACK, [], { bin: registry().dir }).code).toBe(2);
    expect(run(ROLLBACK, ['latest'], { bin: registry().dir }).code).toBe(2);
    expect(run(ROLLBACK, ['1.6.2', '--to', 'x'], { bin: registry().dir }).code).toBe(2);
    expect(run(ROLLBACK, ['1.6.2', 'extra'], { bin: registry().dir }).code).toBe(2);
    const offline = fakeTools({ [`npm view ${PKG} versions --json`]: { code: 1 } });
    expect(run(ROLLBACK, ['1.6.2'], { bin: offline.dir }).code).toBe(1);
  });

  it('copes with a registry that lists a single version', () => {
    const tools = fakeTools({ [`npm view ${PKG} versions --json`]: { out: '"1.6.2"' } });
    expect(run(ROLLBACK, ['1.6.2'], { bin: tools.dir }).out).toContain('pass --to <version>');
  });
});
