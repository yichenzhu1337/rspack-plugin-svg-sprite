import { describe, it, expect } from '@rstest/core';
import fs from 'fs';
import path from 'path';
import {
  LOADER,
  SvgSpritePlugin,
  build,
  makeProject,
  removeProject,
  symbolIds,
  ALL_BUNDLERS,
} from './helpers';

const CORPUS = path.join(process.cwd(), 'src/__tests__/fixtures/corpus/icons');
const FILES = fs
  .readdirSync(CORPUS)
  .filter((name) => name.endsWith('.svg'))
  .sort();

describe('real-world corpus in a real build', () => {
  it('extract mode emits one symbol per file with unique ids', async () => {
    const files: Record<string, string> = {};
    let entry = '';
    FILES.forEach((file, i) => {
      files['icons/' + file] = fs.readFileSync(path.join(CORPUS, file), 'utf8');
      entry += 'import i' + i + " from './icons/" + file + "';\n";
    });
    entry += 'export default [' + FILES.map((_, i) => 'i' + i).join(',') + '];\n';
    files['index.js'] = entry;
    const dir = makeProject(files);
    try {
      const result = await build(ALL_BUNDLERS[0]!.impl, {
        mode: 'production',
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
              loader: LOADER,
              options: { extract: true },
            },
          ],
        },
        plugins: [new SvgSpritePlugin()],
      });
      expect(result.hasErrors).toBe(false);

      const ids = symbolIds(path.join(dir, 'out', 'sprite.svg'));
      expect(ids.length).toBe(FILES.length);
      expect(new Set(ids).size).toBe(FILES.length);
      expect(ids.slice().sort()).toEqual(FILES.map((f) => path.basename(f, '.svg')).sort());
    } finally {
      removeProject(dir);
    }
  });
});
