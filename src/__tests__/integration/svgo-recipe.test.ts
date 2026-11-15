import { describe, it, expect } from '@rstest/core';
import path from 'path';
import { ALL_BUNDLERS, LOADER, build, makeProject, nodeRequire, removeProject } from './helpers';

// The README recipe for icons that share ids or class names (for example two SVGO-minified
// gradients that both use id="a"). This test keeps that documented recipe true.
const icon = (from: string, to: string) =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><defs>' +
  '<linearGradient id="a"><stop offset="0" stop-color="' +
  from +
  '"/><stop offset="1" stop-color="' +
  to +
  '"/></linearGradient><style>.cls-1{stroke:' +
  from +
  '}</style></defs><rect width="16" height="16" fill="url(#a)" class="cls-1"/></svg>';

describe('README recipe: svgo-loader with prefixIds', () => {
  for (const { name, impl } of ALL_BUNDLERS) {
    it(
      name + ': two icons that share an id and a class no longer collide',
      async () => {
        const dir = makeProject({
          'icons/sun.svg': icon('red', 'yellow'),
          'icons/sea.svg': icon('blue', 'green'),
          'index.js':
            "import sun from './icons/sun.svg';\nimport sea from './icons/sea.svg';\n" +
            'export default { sun, sea };\n',
        });
        try {
          const result = await build(impl, {
            mode: 'development',
            devtool: false,
            target: 'node',
            context: dir,
            entry: './index.js',
            output: {
              path: path.join(dir, 'out'),
              filename: 'bundle.js',
              library: { type: 'commonjs2' },
            },
            module: {
              rules: [
                {
                  test: /\.svg$/,
                  type: 'javascript/auto',
                  use: [
                    { loader: LOADER },
                    {
                      loader: nodeRequire.resolve('svgo-loader'),
                      options: { plugins: [{ name: 'prefixIds' }] },
                    },
                  ],
                },
              ],
            },
          });
          expect(result.hasErrors).toBe(false);

          const mod = nodeRequire(path.join(dir, 'out', 'bundle.js'));
          const { sun, sea } = mod.default || mod;
          expect(sun.content).toContain('id="sun_svg__a"');
          expect(sun.content).toContain('fill="url(#sun_svg__a)"');
          expect(sun.content).toContain('class="sun_svg__cls-1"');
          expect(sea.content).toContain('id="sea_svg__a"');
          expect(sea.content).toContain('fill="url(#sea_svg__a)"');
          expect(sea.content).toContain('class="sea_svg__cls-1"');
          expect(sea.content).not.toContain('sun_svg__');
        } finally {
          removeProject(dir);
        }
      },
      60000,
    );
  }
});
