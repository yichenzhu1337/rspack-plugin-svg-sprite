import { describe, it, expect } from '@rstest/core';
import { run, script } from './helpers';

const CHECK = script('ci', 'pr-title-check.mts');
const title = (value: string) => run(CHECK, [], { env: { PR_TITLE: value } });

describe('pr-title-check', () => {
  it.each([
    'fix: keep every icon in watch mode',
    'feat(loader)!: drop the include option',
    'ci(release): add a rollback script',
    'chore: version packages',
  ])('accepts %s', (value) => {
    const result = title(value);
    expect(result.code).toBe(0);
    expect(result.summary).toContain('valid Conventional Commit title');
  });

  it('accepts the title GitHub gives a revert', () => {
    expect(title('Revert "feat: add a thing"').code).toBe(0);
  });

  it.each([
    ['add a thing', 'does not match'],
    ['wip: add a thing', 'is not a known type'],
    ['fix(Loader): add a thing', 'scope must be lowercase'],
    ['fix:  ', 'description is empty'],
    ['fix: add a thing.', 'ends with a period'],
    ['fix:  padded', 'extra spaces'],
    [`fix: ${'x'.repeat(100)}`, 'characters long'],
    ['', 'does not match'],
  ])('rejects %j', (value, reason) => {
    const result = title(value);
    expect(result.code).toBe(1);
    expect(result.out).toContain(reason);
    expect(result.summary).toContain('How to fix');
  });

  it('reports more than one problem at once', () => {
    const result = title('wip(Bad): thing.');
    expect(result.code).toBe(1);
    expect(result.out).toContain('is not a known type');
    expect(result.out).toContain('scope must be lowercase');
    expect(result.out).toContain('ends with a period');
  });

  it('rejects a title missing from the environment', () => {
    expect(run(CHECK).code).toBe(1);
  });
});
