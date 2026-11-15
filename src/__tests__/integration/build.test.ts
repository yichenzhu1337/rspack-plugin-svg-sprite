import { describe, it, expect } from '@rstest/core';
import fs from 'fs';
import path from 'path';
import {
  ALL_BUNDLERS,
  LOADER,
  SvgSpritePlugin,
  build,
  fixture,
  makeProject,
  nodeRequire,
  removeProject,
  symbolIds,
} from './helpers';

function project(entry: string): string {
  return makeProject({
    'icons/star.svg': fixture('star.svg'),
    'icons/arrow.svg': fixture('arrow.svg'),
    'icons/circle.svg': fixture('circle.svg'),
    'img/logo.svg': fixture('circle.svg'),
    'index.js': entry,
  });
}

const ALL_ICONS =
  "import star from './icons/star.svg';\n" +
  "import arrow from './icons/arrow.svg';\n" +
  "import circle from './icons/circle.svg';\n" +
  'export default { star, arrow, circle };\n';

function config(dir: string, extract: boolean): any {
  return {
    mode: 'production',
    devtool: false,
    target: 'node',
    context: dir,
    entry: './index.js',
    output: {
      path: path.join(dir, 'out'),
      filename: 'bundle.js',
      library: { type: 'commonjs2' },
      publicPath: '/assets/',
    },
    module: {
      rules: [
        {
          test: /\.svg$/,
          type: 'javascript/auto',
          loader: LOADER,
          options: { extract, symbolId: 'icon-[name]' },
        },
      ],
    },
    plugins: extract ? [new SvgSpritePlugin()] : [],
  };
}

function exported(dir: string): Record<string, any> {
  const mod = nodeRequire(path.join(dir, 'out', 'bundle.js'));
  return mod.default || mod;
}

describe('real builds', () => {
  for (const { name, impl } of ALL_BUNDLERS) {
    it(
      name + ': inline mode exports the v1 symbol shape',
      async () => {
        const dir = project(ALL_ICONS);
        try {
          const result = await build(impl, config(dir, false));
          expect(result.hasErrors).toBe(false);
          expect(result.warnings).toEqual([]);
          expect(fs.readdirSync(path.join(dir, 'out'))).toEqual(['bundle.js']);

          const icons = exported(dir);
          expect(icons.star.id).toBe('icon-star');
          expect(icons.star.url).toBe('#icon-star');
          expect(icons.star.viewBox).toBe('0 0 32 32');
          expect(icons.star.content).toContain('<symbol id="icon-star" viewBox="0 0 32 32">');
          expect(String(icons.arrow)).toBe('#icon-arrow');
        } finally {
          removeProject(dir);
        }
      },
      60000,
    );

    it(
      name + ': extract mode exports the v1 symbol shape and emits a deterministic sprite',
      async () => {
        const sprites: string[] = [];
        for (let run = 0; run < 3; run++) {
          const dir = project(ALL_ICONS);
          try {
            const result = await build(impl, config(dir, true));
            expect(result.hasErrors).toBe(false);
            expect(result.warnings).toEqual([]);

            const icons = exported(dir);
            expect(icons.star.id).toBe('icon-star');
            expect(icons.star.url).toBe('/assets/sprite.svg#icon-star');
            expect(icons.circle.viewBox).toBe('0 0 100 100');

            const sprite = path.join(dir, 'out', 'sprite.svg');
            expect(symbolIds(sprite)).toEqual(['icon-arrow', 'icon-circle', 'icon-star']);
            sprites.push(fs.readFileSync(sprite, 'utf8'));
          } finally {
            removeProject(dir);
          }
        }
        expect(sprites[1]).toBe(sprites[0]);
        expect(sprites[2]).toBe(sprites[0]);
      },
      90000,
    );

    it(
      name + ': warns when another rule turns the SVG into an asset module',
      async () => {
        const dir = project("import star from './icons/star.svg';\nconsole.log(star);\n");
        try {
          const result = await build(impl, {
            mode: 'development',
            devtool: false,
            context: dir,
            entry: './index.js',
            output: { path: path.join(dir, 'out'), filename: 'bundle.js' },
            module: {
              rules: [
                { test: /\.svg$/, loader: LOADER },
                { test: /\.(png|svg)$/, type: 'asset/inline' },
              ],
            },
          });
          // Backwards compatible: the build result is unchanged, the mistake is just visible now.
          expect(result.hasErrors).toBe(false);
          expect(result.warnings).toHaveLength(1);
          expect(result.warnings[0]).toContain(path.join(dir, 'icons', 'star.svg'));
          expect(result.warnings[0]).toContain('"asset/inline"');
          expect(result.warnings[0]).toContain('type: "javascript/auto"');
        } finally {
          removeProject(dir);
        }
      },
      60000,
    );

    it(
      name + ': stays silent for SVGs that are intentionally assets',
      async () => {
        const dir = project(
          "import star from './icons/star.svg';\n" +
            "import logo from './img/logo.svg';\n" +
            "const hero = new URL('./img/logo.svg', import.meta.url);\n" +
            'console.log(star, logo, hero);\n',
        );
        try {
          const result = await build(impl, {
            mode: 'development',
            devtool: false,
            context: dir,
            entry: './index.js',
            output: { path: path.join(dir, 'out'), filename: 'bundle.js' },
            module: {
              rules: [
                {
                  test: /\.svg$/,
                  include: [path.join(dir, 'icons')],
                  type: 'javascript/auto',
                  loader: LOADER,
                },
                { test: /\.svg$/, exclude: [path.join(dir, 'icons')], type: 'asset/resource' },
              ],
            },
          });
          expect(result.hasErrors).toBe(false);
          expect(result.warnings).toEqual([]);
        } finally {
          removeProject(dir);
        }
      },
      60000,
    );
  }
});
