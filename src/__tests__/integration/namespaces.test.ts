import { describe, it, expect } from '@rstest/core';
import fs from 'fs';
import path from 'path';
import { Parser } from 'htmlparser2';
import {
  LOADER,
  SvgSpritePlugin,
  build,
  fixture,
  makeProject,
  removeProject,
  ALL_BUNDLERS,
} from './helpers';

const INKSCAPE = fs.readFileSync(
  path.join(process.cwd(), 'src/__tests__/fixtures/corpus/icons/messy--inkscape-export.svg'),
  'utf8',
);

/** Returns every element or attribute name whose prefix is not bound by an enclosing `xmlns:*`. */
function unboundPrefixes(xml: string): string[] {
  const scopes: Array<Set<string>> = [];
  const unbound: string[] = [];
  const predefined = new Set(['xml', 'xmlns']);
  const isBound = (prefix: string) =>
    predefined.has(prefix) || scopes.some((scope) => scope.has(prefix));
  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const scope = new Set<string>();
        for (const key of Object.keys(attribs)) {
          if (key.startsWith('xmlns:')) scope.add(key.slice(6));
        }
        scopes.push(scope);
        for (const n of [name, ...Object.keys(attribs)]) {
          const i = n.indexOf(':');
          if (i > 0 && !isBound(n.slice(0, i))) unbound.push(n);
        }
      },
      onclosetag() {
        scopes.pop();
      },
    },
    { xmlMode: true },
  );
  parser.write(xml);
  parser.end();
  return unbound;
}

describe('namespace prefixes in the extracted sprite', () => {
  it('the checker flags an unbound prefix and accepts a bound one', () => {
    expect(unboundPrefixes('<svg><g a:b="1"/></svg>')).toEqual(['a:b']);
    expect(unboundPrefixes('<svg><x:g xmlns:x="u"><y xml:space="p"/></x:g></svg>')).toEqual([]);
  });

  for (const bundler of ALL_BUNDLERS) {
    it('keeps the sprite namespace well-formed (' + bundler.name + ')', async () => {
      const dir = makeProject({
        'ink.svg': INKSCAPE,
        'star.svg': fixture('star.svg'),
        'index.js':
          "import a from './ink.svg'; import b from './star.svg'; export default [a, b];\n",
      });
      try {
        const result = await build(bundler.impl, {
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
        const sprite = fs.readFileSync(path.join(dir, 'out', 'sprite.svg'), 'utf8');
        expect(sprite).toContain('<symbol id="ink"');
        expect(unboundPrefixes(sprite)).toEqual([]);
        expect(sprite).toContain('xmlns:inkscape=');
      } finally {
        removeProject(dir);
      }
    });
  }
});
