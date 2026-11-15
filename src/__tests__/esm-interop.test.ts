import { describe, it, expect, beforeAll } from '@rstest/core';
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

// These run real Node imports against the built package (dist/), resolved through the
// package's own "exports" map (self-reference), the same way a consumer's config would.
function runNode(code: string, esm: boolean) {
  const args = esm ? ['--input-type=module', '-e', code] : ['-e', code];
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

describe('package entry points as seen by consumers', () => {
  beforeAll(() => {
    if (!existsSync(resolve(process.cwd(), 'dist/index.js'))) {
      throw new Error('dist/ is missing: run `pnpm build` first (`pnpm test` does this).');
    }
  });

  it('supports a named ESM import of SvgSpritePlugin', () => {
    const result = runNode(
      "import { SvgSpritePlugin } from 'rspack-plugin-svg-sprite'; console.log(typeof SvgSpritePlugin);",
      true,
    );
    expect(result).toMatchObject({ status: 0, stdout: 'function' });
  });

  it('gives ESM default and named imports the same plugin class', () => {
    const result = runNode(
      "import Plugin, { SvgSpritePlugin } from 'rspack-plugin-svg-sprite';" +
        'console.log(typeof Plugin, Plugin === SvgSpritePlugin, Plugin.default === Plugin);',
      true,
    );
    expect(result).toMatchObject({ status: 0, stdout: 'function true true' });
  });

  it('keeps require() returning the plugin class itself', () => {
    const result = runNode(
      "const Plugin = require('rspack-plugin-svg-sprite');" +
        'console.log(typeof Plugin, Plugin.SvgSpritePlugin === Plugin, typeof new Plugin().apply);',
      false,
    );
    expect(result).toMatchObject({ status: 0, stdout: 'function true function' });
  });

  it('supports a named ESM import from the rsbuild subpath', () => {
    const result = runNode(
      "import { pluginSvgSprite } from 'rspack-plugin-svg-sprite/rsbuild'; console.log(typeof pluginSvgSprite);",
      true,
    );
    expect(result).toMatchObject({ status: 0, stdout: 'function' });
  });
});
