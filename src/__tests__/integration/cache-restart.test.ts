import { describe, it, expect } from '@rstest/core';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { DIST, LOADER, makeProject, nodeRequire, removeProject, svg } from './helpers';

// Regression: with a persistent (on-disk) build cache, the second process restored the SVG
// modules from cache without running the loader, so no symbol was registered and no sprite was
// emitted. Each compile below runs in its own Node process, exactly like two CI runs.
const SCRIPT = `
const fs = require('fs');
const path = require('path');
const [bundlerEntry, pluginEntry, loader, dir, cacheJson] = process.argv.slice(2);
const bundler = require(bundlerEntry);
const SvgSpritePlugin = require(pluginEntry);
const out = path.join(dir, 'out');
fs.rmSync(out, { recursive: true, force: true });
console.warn = () => {};
const compiler = bundler({
  context: dir,
  mode: 'production',
  devtool: false,
  entry: './src/index.js',
  output: { path: out, filename: 'bundle.js' },
  ...JSON.parse(cacheJson),
  module: {
    rules: [{ test: /\\.svg$/, type: 'javascript/auto', loader, options: { extract: true } }],
  },
  plugins: [new SvgSpritePlugin()],
});
compiler.run((err, stats) => {
  compiler.close(() => {
    const file = path.join(out, 'sprite.svg');
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const ids = [];
    text.replace(/<symbol id="([^"]+)"/g, (_, id) => ids.push(id));
    process.stdout.write(JSON.stringify({ failed: !!err || stats.hasErrors(), ids }));
  });
});
`;

interface Case {
  name: string;
  bundler: string;
  cache: (cacheDir: string) => Record<string, unknown>;
}

const CASES: Case[] = [
  {
    name: 'webpack 5 (cache.type filesystem)',
    bundler: 'webpack',
    cache: (cacheDir) => ({ cache: { type: 'filesystem', cacheDirectory: cacheDir } }),
  },
  {
    name: 'rspack 1 (experiments.cache persistent)',
    bundler: '@rspack/core',
    cache: (cacheDir) => ({
      cache: true,
      experiments: {
        cache: { type: 'persistent', storage: { type: 'filesystem', directory: cacheDir } },
      },
    }),
  },
  {
    name: 'rspack 2 (cache.type persistent)',
    bundler: 'rspack-v2',
    cache: (cacheDir) => ({
      cache: { type: 'persistent', storage: { type: 'filesystem', directory: cacheDir } },
    }),
  },
];

describe('extract mode with a persistent build cache', () => {
  for (const testCase of CASES) {
    it(
      testCase.name + ': a warm restart still emits the full sprite',
      () => {
        const dir = makeProject({
          'src/a.svg': svg('M1 1L15 15'),
          'src/b.svg': svg('M3 3L9 9'),
          'src/index.js':
            'import a from "./a.svg";\nimport b from "./b.svg";\nconsole.log(a, b);\n',
          'build.js': SCRIPT,
        });
        try {
          const args = [
            path.join(dir, 'build.js'),
            nodeRequire.resolve(testCase.bundler),
            path.join(DIST, 'index.js'),
            LOADER,
            dir,
            JSON.stringify(testCase.cache(path.join(dir, '.cache'))),
          ];
          const run = () => JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8' }));

          const cold = run();
          expect(cold).toEqual({ failed: false, ids: ['a', 'b'] });
          expect(fs.existsSync(path.join(dir, '.cache'))).toBe(true);

          const warm = run();
          expect(warm).toEqual({ failed: false, ids: ['a', 'b'] });
        } finally {
          removeProject(dir);
        }
      },
      90000,
    );
  }
});
