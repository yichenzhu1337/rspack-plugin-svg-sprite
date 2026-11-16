import { describe, it, expect, beforeAll } from '@rstest/core';
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

// The ESM entry points (dist/*.mjs) wrap the CommonJS build. These run real Node imports through
// the package's own "exports" map, the same way a consumer's config or app would.
const PKG = 'rspack-plugin-svg-sprite';
const DIST = resolve(process.cwd(), 'dist');

function esm(code: string) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

describe('ESM entry points', () => {
  beforeAll(() => {
    if (!existsSync(join(DIST, 'index.mjs'))) {
      throw new Error('dist/ is missing: run `pnpm build` first (`pnpm test` does this).');
    }
  });

  it('gives the plugin class as the default import of /plugin', () => {
    const result = esm(
      `import P, { resolveRawSource } from '${PKG}/plugin';` +
        `import Root from '${PKG}';` +
        'console.log(typeof new P().apply, P === Root, P.default === P, P.resolveRawSource === resolveRawSource);',
    );
    expect(result).toMatchObject({ status: 0, stdout: 'function true true true' });
  });

  it('gives the loader function as the default import of /loader, with the CommonJS one', () => {
    const result = esm(
      `import { createRequire } from 'node:module';` +
        `import loader, { NAMESPACE, parseViewBox } from '${PKG}/loader';` +
        `const cjs = createRequire(import.meta.url)('${PKG}/loader');` +
        'console.log(loader === cjs.default, loader.NAMESPACE === NAMESPACE, loader.parseViewBox === parseViewBox, parseViewBox(\'<svg viewBox="0 0 8 8">\'));',
    );
    expect(result).toMatchObject({ status: 0, stdout: 'true true true 0 0 8 8' });
  });

  it('shares one runtime instance between ESM imports and the require() the loader emits', () => {
    const result = esm(
      `import { createRequire } from 'node:module';` +
        `import sprite from '${PKG}/runtime/browser-sprite';` +
        `import SpriteSymbol from '${PKG}/runtime/symbol';` +
        `const require = createRequire(import.meta.url);` +
        `const cjsSprite = require('${PKG}/runtime/browser-sprite').default;` +
        `const CjsSymbol = require('${PKG}/runtime/symbol').default;` +
        "const s = new SpriteSymbol({ id: 'a', viewBox: '0 0 1 1', content: '' });" +
        'console.log(sprite === cjsSprite, SpriteSymbol === CjsSymbol, s.url, typeof sprite.add);',
    );
    expect(result).toMatchObject({ status: 0, stdout: 'true true #a function' });
  });

  it('keeps the Rsbuild default import as the exports object', () => {
    const result = esm(
      `import rsbuild, { pluginSvgSprite } from '${PKG}/rsbuild';` +
        'console.log(rsbuild.pluginSvgSprite === pluginSvgSprite, pluginSvgSprite().name);',
    );
    expect(result).toMatchObject({ status: 0, stdout: 'true rsbuild-plugin-svg-sprite' });
  });

  it('keeps the runtime wrappers browser-safe (no Node built-ins, no require)', () => {
    for (const file of ['runtime/symbol.mjs', 'runtime/browser-sprite.mjs', 'interop.mjs']) {
      const code = readFileSync(join(DIST, file), 'utf8')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(/node:|createRequire|\brequire\(|await /);
      for (const [, spec] of code.matchAll(/from '([^']+)'/g)) {
        expect(spec!.startsWith('.')).toBe(true);
      }
    }
  });

  it('exports package.json', () => {
    const result = esm(
      `import { createRequire } from 'node:module';` +
        `console.log(createRequire(import.meta.url)('${PKG}/package.json').name);`,
    );
    expect(result).toMatchObject({ status: 0, stdout: PKG });
  });
});

describe('package layout', () => {
  const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));

  it('points every exports target at a built file', () => {
    const targets: string[] = [];
    const walk = (value: unknown) => {
      if (typeof value === 'string') targets.push(value);
      else if (value && typeof value === 'object') Object.values(value).forEach(walk);
    };
    walk(pkg.exports);
    walk(pkg.typesVersions);
    for (const target of targets) {
      expect(existsSync(resolve(process.cwd(), target))).toBe(true);
    }
  });

  it('ships source maps with embedded sources and no absolute paths', () => {
    const maps: string[] = [];
    const collect = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const abs = join(dir, entry.name);
        if (entry.isDirectory()) collect(abs);
        else if (entry.name.endsWith('.map')) maps.push(abs);
      }
    };
    collect(DIST);
    expect(maps.length).toBeGreaterThan(0);
    for (const file of maps) {
      const map = JSON.parse(readFileSync(file, 'utf8'));
      expect(map.sourcesContent).toHaveLength(map.sources.length);
      for (const source of map.sources) {
        expect(source.startsWith('/') || /^[A-Za-z]:/.test(source)).toBe(false);
      }
    }
  });
});
