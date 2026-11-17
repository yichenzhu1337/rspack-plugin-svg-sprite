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
  removeProject,
  symbolIds,
} from './helpers';

describe('the same symbol id in different sprite files', () => {
  for (const { name, impl } of ALL_BUNDLERS) {
    it(
      name + ': each sprite file is emitted with its own drawing and no duplicate warning',
      async () => {
        const dir = makeProject({
          'a/home.svg': fixture('star.svg'),
          'b/home.svg': fixture('circle.svg'),
          'index.js':
            "import a from './a/home.svg';\nimport b from './b/home.svg';\n" +
            'export default { a, b };\n',
        });
        const rule = (folder: string, spriteFilename: string) => ({
          test: /\.svg$/,
          include: path.join(dir, folder),
          type: 'javascript/auto',
          loader: LOADER,
          options: { extract: true, symbolId: '[name]', spriteFilename },
        });
        const warn = console.warn;
        const printed: string[] = [];
        console.warn = (...args: unknown[]) => void printed.push(args.join(' '));
        try {
          const result = await build(impl, {
            mode: 'production',
            devtool: false,
            target: 'node',
            context: dir,
            entry: './index.js',
            output: {
              path: path.join(dir, 'out'),
              filename: 'bundle.js',
              library: { type: 'commonjs2' },
              publicPath: '/',
            },
            module: { rules: [rule('a', 'a.svg'), rule('b', 'b.svg')] },
            plugins: [new SvgSpritePlugin()],
          });
          expect(result.hasErrors).toBe(false);
          expect(result.warnings).toEqual([]);
          expect(printed.filter((m) => m.includes('Duplicate symbol'))).toEqual([]);

          const a = path.join(dir, 'out', 'a.svg');
          const b = path.join(dir, 'out', 'b.svg');
          expect(fs.existsSync(a)).toBe(true);
          expect(fs.existsSync(b)).toBe(true);
          expect(symbolIds(a)).toEqual(['home']);
          expect(symbolIds(b)).toEqual(['home']);
          expect(fs.readFileSync(a, 'utf8')).toContain('<polygon');
          expect(fs.readFileSync(a, 'utf8')).not.toContain('<circle');
          expect(fs.readFileSync(b, 'utf8')).toContain('<circle');
          expect(fs.readFileSync(b, 'utf8')).not.toContain('<polygon');
        } finally {
          console.warn = warn;
          removeProject(dir);
        }
      },
      60000,
    );
  }
});
