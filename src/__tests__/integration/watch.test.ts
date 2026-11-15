import { describe, it, expect } from '@rstest/core';
import fs from 'fs';
import path from 'path';
import {
  ALL_BUNDLERS,
  LOADER,
  SvgSpritePlugin,
  makeProject,
  quiet,
  removeProject,
  startWatch,
  svg,
  symbolIds,
} from './helpers';

// Regression: before this fix the extract sprite lost every icon whose module was served from
// the bundler's cache on an incremental rebuild.
describe('extract mode in watch mode', () => {
  for (const { name, impl } of ALL_BUNDLERS) {
    it(
      name + ': the sprite keeps every imported icon across rebuilds',
      async () => {
        const dir = makeProject({
          'src/a.svg': svg('M1 1L15 15'),
          'src/b.svg': svg('M3 3L9 9'),
          'src/index.js':
            'import a from "./a.svg";\nimport b from "./b.svg";\nconsole.log(a, b);\n',
        });
        const sprite = path.join(dir, 'out', 'sprite.svg');
        const index = path.join(dir, 'src', 'index.js');

        await quiet(async () => {
          const watcher = await startWatch(impl, {
            context: dir,
            mode: 'development',
            devtool: false,
            entry: './src/index.js',
            output: { path: path.join(dir, 'out'), filename: 'bundle.js', clean: true },
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

          try {
            expect(symbolIds(sprite)).toEqual(['a', 'b']);

            // 1. edit one icon: the other one must survive, the edit must land
            await watcher.change(() =>
              fs.writeFileSync(path.join(dir, 'src', 'a.svg'), svg('M2 2L14 14')),
            );
            expect(symbolIds(sprite)).toEqual(['a', 'b']);
            expect(fs.readFileSync(sprite, 'utf8')).toContain('M2 2L14 14');

            // 2. edit an unrelated JS file: the sprite must still exist with both icons
            await watcher.change(() => fs.appendFileSync(index, 'console.log("touched");\n'));
            expect(symbolIds(sprite)).toEqual(['a', 'b']);

            // 3. drop an import: that icon leaves the sprite, the other stays
            await watcher.change(() =>
              fs.writeFileSync(index, 'import a from "./a.svg";\nconsole.log(a);\n'),
            );
            expect(symbolIds(sprite)).toEqual(['a']);
          } finally {
            await watcher.close();
            removeProject(dir);
          }
        });
      },
      90000,
    );
  }
});
