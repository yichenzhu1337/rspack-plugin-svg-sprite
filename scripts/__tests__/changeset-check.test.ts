import { describe, it, expect } from '@rstest/core';
import { commit, makeRepo, run, script } from './helpers';

const CHECK = script('ci', 'changeset-check.mjs');
const PKG = 'rspack-plugin-svg-sprite';
const PACKAGE_JSON = JSON.stringify({
  name: PKG,
  version: '1.0.0',
  main: 'dist/index.js',
  scripts: { build: 'tsc' },
  devDependencies: { a: '1.0.0' },
});

function check(
  change: Record<string, string>,
  env: Record<string, string> = {},
  headRef = 'feature/x',
) {
  const { dir, base } = makeRepo({ 'package.json': PACKAGE_JSON, 'README.md': '# demo\n' });
  commit(dir, change);
  return run(CHECK, [], { cwd: dir, env: { BASE_SHA: base, HEAD_REF: headRef, ...env } });
}

const changeset = (body = `---\n"${PKG}": patch\n---\n\nFix a thing.\n`) => ({
  '.changeset/brave-owl.md': body,
});

describe('changeset-check', () => {
  it('needs a changeset when src/ changes outside the tests', () => {
    const result = check({ 'src/loader.ts': 'export {};\n' });
    expect(result.code).toBe(1);
    expect(result.out).toContain('adds no changeset');
    expect(result.summary).toContain('How to fix');
  });

  it('needs a changeset when client.d.ts changes', () => {
    expect(check({ 'client.d.ts': 'export {};\n' }).code).toBe(1);
  });

  it('needs a changeset when a published package.json field changes', () => {
    const changed = JSON.stringify({ ...JSON.parse(PACKAGE_JSON), main: 'dist/other.js' });
    const result = check({ 'package.json': changed });
    expect(result.code).toBe(1);
    expect(result.out).toContain('package.json (published fields)');
  });

  it('does not need one for devDependencies, scripts and version changes', () => {
    const changed = JSON.stringify({
      ...JSON.parse(PACKAGE_JSON),
      version: '1.0.1',
      scripts: { build: 'tsc -b' },
      devDependencies: { a: '2.0.0' },
    });
    expect(check({ 'package.json': changed }).code).toBe(0);
  });

  it('does not need one for tests, docs and CI', () => {
    const result = check({
      'src/__tests__/a.test.ts': 'export {};\n',
      'docs/guide.md': 'x\n',
      '.github/workflows/ci.yml': 'name: x\n',
    });
    expect(result.code).toBe(0);
    expect(result.summary).toContain('no changeset needed');
  });

  it('passes with a valid changeset', () => {
    const result = check({ 'src/loader.ts': 'export {};\n', ...changeset() });
    expect(result.code).toBe(0);
    expect(result.summary).toContain('.changeset/brave-owl.md');
  });

  it('is exempt on the version PR branch', () => {
    const result = check({ 'src/loader.ts': 'export {};\n' }, {}, 'changeset-release/main');
    expect(result.code).toBe(0);
    expect(result.summary).toContain('Version PR');
  });

  it('is exempt with the no-changeset label', () => {
    const result = check({ 'src/loader.ts': 'export {};\n' }, { LABELS: '["no-changeset"]' });
    expect(result.code).toBe(0);
    expect(result.summary).toContain('no-changeset');
  });

  it('rejects a changeset without front matter', () => {
    const result = check(changeset('Fix a thing.\n'));
    expect(result.code).toBe(1);
    expect(result.out).toContain('missing the --- front matter block');
  });

  it('rejects a changeset that names no package', () => {
    const result = check(changeset('---\n\n---\n\nFix a thing.\n'));
    expect(result.code).toBe(1);
  });

  it('rejects the wrong package or bump, and an empty summary', () => {
    const wrong = check(changeset('---\n"other-pkg": patch\n---\n\nText.\n'));
    expect(wrong.code).toBe(1);
    expect(wrong.out).toContain('expected "rspack-plugin-svg-sprite": patch | minor | major');
    const bump = check(changeset(`---\n"${PKG}": huge\n---\n\nText.\n`));
    expect(bump.code).toBe(1);
    const empty = check(changeset(`---\n"${PKG}": minor\n---\n\n`));
    expect(empty.code).toBe(1);
    expect(empty.out).toContain('summary for users is empty');
  });

  it('accepts single quotes and no quotes around the package name', () => {
    expect(check(changeset(`---\n'${PKG}': minor\n---\n\nText.\n`)).code).toBe(0);
    expect(check(changeset(`---\n${PKG}: major\n---\n\nText.\n`)).code).toBe(0);
  });

  it('stops without BASE_SHA', () => {
    const { dir } = makeRepo();
    expect(run(CHECK, [], { cwd: dir }).code).not.toBe(0);
  });
});
