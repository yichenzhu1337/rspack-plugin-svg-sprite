import { describe, it, expect } from '@rstest/core';
import path from 'path';
import {
  LOADER,
  SvgSpritePlugin,
  fixture,
  makeProject,
  nodeRequire,
  removeProject,
  symbolIds,
} from './helpers';

/**
 * Runs one build through webpack's callback form, which closes the compiler and so writes the
 * persistent cache. The cache write hashes every asset, and its failure is reported only there.
 */
function buildAndClose(webpack: any, config: any): Promise<boolean> {
  return new Promise((resolve, reject) => {
    webpack(config, (err: Error | null, stats: any) => {
      if (err) return reject(err);
      resolve(stats.hasErrors());
    });
  });
}

// Regression (#54): webpack hashes every asset source with `updateHash` when an output name has
// a content hash. The sprite used a RawSource without `updateHash` whenever `webpack-sources`
// could not be required from this package (pnpm, Yarn PnP, Bun), so the build failed.
describe('webpack 5 production build with [contenthash] and a filesystem cache', () => {
  it('builds twice without errors and emits the sprite', async () => {
    const webpack = nodeRequire('webpack');
    const dir = makeProject({
      'star.svg': fixture('star.svg'),
      'index.js': "import star from './star.svg';\nexport default star;\n",
    });
    try {
      const config = () => ({
        mode: 'production',
        devtool: false,
        target: 'node',
        context: dir,
        entry: './index.js',
        output: { path: path.join(dir, 'out'), filename: '[name].[contenthash].js' },
        cache: { type: 'filesystem', cacheDirectory: path.join(dir, '.cache') },
        module: {
          rules: [
            {
              test: /\.svg$/,
              type: 'javascript/auto',
              loader: LOADER,
              options: { extract: true },
            },
          ],
        },
        plugins: [new SvgSpritePlugin()],
      });
      expect(await buildAndClose(webpack, config())).toBe(false);
      expect(symbolIds(path.join(dir, 'out', 'sprite.svg'))).toEqual(['star']);
      expect(await buildAndClose(webpack, config())).toBe(false);
      expect(symbolIds(path.join(dir, 'out', 'sprite.svg'))).toEqual(['star']);
    } finally {
      removeProject(dir);
    }
  });
});
