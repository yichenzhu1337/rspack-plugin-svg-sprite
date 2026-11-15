import { describe, it, expect } from '@rstest/core';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import loader, { NAMESPACE } from '../loader';

const ROOT = process.cwd();
const STAR = fs.readFileSync(path.join(ROOT, 'src/__tests__/fixtures/star.svg'), 'utf8');

interface Recorded {
  cacheable: unknown[][];
  warnings: Error[];
}

function run(options: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const recorded: Recorded = { cacheable: [], warnings: [] };
  const ctx = {
    resourcePath: path.join(ROOT, 'src/__tests__/fixtures/star.svg'),
    cacheable(...args: unknown[]) {
      recorded.cacheable.push(args);
    },
    emitWarning(warning: Error) {
      recorded.warnings.push(warning);
    },
    getOptions: () => options,
    _compilation: { [NAMESPACE]: { addSymbol() {} } },
    ...extra,
  };
  const output = loader.call(ctx as any, STAR);
  return { output, recorded };
}

describe('caching', () => {
  it('inline mode stays cacheable, called exactly as in v1', () => {
    expect(run({}).recorded.cacheable).toEqual([[]]);
    expect(run({ extract: false }).recorded.cacheable).toEqual([[]]);
  });

  it('extract mode opts out of caching so the symbol is registered on every build', () => {
    expect(run({ extract: true }).recorded.cacheable).toEqual([[false]]);
  });
});

describe('asset module type warning', () => {
  it.each(['asset', 'asset/inline', 'asset/resource', 'asset/source'])(
    'warns once when the module type is "%s"',
    (type) => {
      const { recorded } = run({}, { _module: { type } });
      expect(recorded.warnings).toHaveLength(1);
      const message = recorded.warnings[0].message;
      expect(message).toContain('[rspack-plugin-svg-sprite]');
      expect(message).toContain(path.join(ROOT, 'src/__tests__/fixtures/star.svg'));
      expect(message).toContain('"' + type + '"');
      expect(message).toContain('type: "javascript/auto"');
    },
  );

  it.each(['javascript/auto', 'javascript/esm', 'javascript/dynamic'])(
    'does not warn when the module type is "%s"',
    (type) => {
      expect(run({}, { _module: { type } }).recorded.warnings).toEqual([]);
    },
  );

  it('does not warn when the bundler exposes no module or no module type', () => {
    expect(run({}).recorded.warnings).toEqual([]);
    expect(run({}, { _module: {} }).recorded.warnings).toEqual([]);
    expect(run({}, { _module: { type: 42 } }).recorded.warnings).toEqual([]);
  });

  it('does not throw when emitWarning is unavailable', () => {
    const { output } = run({}, { _module: { type: 'asset/inline' }, emitWarning: undefined });
    expect(output).toContain('sprite.add(symbol)');
  });

  it('never changes the generated module', () => {
    const plain = run({}).output;
    expect(run({}, { _module: { type: 'asset/inline' } }).output).toBe(plain);
    expect(run({}, { _module: { type: 'javascript/auto' } }).output).toBe(plain);
  });
});

// The frozen outputs of the published v1.5.1 loader for every real icon in this repository.
// A failure here means a change altered what existing users get. That is only acceptable for
// an icon v1 mis-parsed, and then the baseline entry must be reviewed and updated on purpose.
describe('byte-for-byte compatibility with published v1.5.1', () => {
  const baseline: Record<string, string> = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'src/__tests__/fixtures/v1-baseline.json'), 'utf8'),
  );

  const normalize = (output: string) =>
    output.replace(
      /require\("[^"]*?[\\/]+runtime[\\/]+(symbol|browser-sprite)"\)/g,
      'require("<runtime>/$1")',
    );

  it('covers all 30 icons in three option sets', () => {
    expect(Object.keys(baseline)).toHaveLength(90);
  });

  it.each(Object.keys(baseline))('%s', (key) => {
    const [file, optionsJson] = key.split(' | ');
    const resourcePath = path.join(ROOT, file);
    const ctx = {
      resourcePath,
      cacheable() {},
      getOptions: () => JSON.parse(optionsJson),
      _compilation: { [NAMESPACE]: { addSymbol() {} } },
      _compiler: { options: { output: { publicPath: '/assets/' } } },
    };
    const output = loader.call(ctx as any, fs.readFileSync(resourcePath, 'utf8'));
    const digest = crypto.createHash('sha256').update(normalize(output)).digest('hex');
    expect(digest).toBe(baseline[key]);
  });
});
