import { describe, it, expect } from '@rstest/core';
import fs from 'fs';
import path from 'path';
import { DIST, fixture, makeProject, nodeRequire, removeProject } from './helpers';

const LINES = [
  { name: 'rsbuild 1', entry: '@rsbuild/core' },
  { name: 'rsbuild 2', entry: 'rsbuild-v2' },
];

function emittedFiles(dir: string): string[] {
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current)) {
      const full = path.join(current, entry);
      if (fs.statSync(full).isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(dir);
  return files;
}

describe('Rsbuild wrapper', () => {
  for (const line of LINES) {
    it(
      line.name + ': pluginSvgSprite turns an SVG import into a sprite symbol',
      async () => {
        const { createRsbuild } = nodeRequire(line.entry);
        const { pluginSvgSprite } = nodeRequire(path.join(DIST, 'rsbuild.js'));
        const dir = makeProject({
          'src/icons/star.svg': fixture('star.svg'),
          'src/index.js': "import star from './icons/star.svg';\nwindow.__ICON = star.id;\n",
        });
        const log = console.log;
        console.log = () => {};
        try {
          const rsbuild = await createRsbuild({
            cwd: dir,
            rsbuildConfig: { plugins: [pluginSvgSprite({ symbolId: 'icon-[name]' })] },
          });
          const result = await rsbuild.build();
          if (result && result.close) await result.close();

          const files = emittedFiles(path.join(dir, 'dist'));
          const js = files
            .filter((file) => file.endsWith('.js'))
            .map((file) => fs.readFileSync(file, 'utf8'))
            .join('\n');
          expect(js).toMatch(/<symbol id=\\?"icon-star\\?"/);
          expect(js).not.toContain('data:image/svg+xml;base64');
          expect(files.filter((file) => file.endsWith('.svg'))).toEqual([]);
        } finally {
          console.log = log;
          removeProject(dir);
        }
      },
      90000,
    );
  }
});
