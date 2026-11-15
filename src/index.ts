import SvgSpritePlugin from './plugin';

export = Object.assign(SvgSpritePlugin, {
  SvgSpritePlugin,
  default: SvgSpritePlugin,
});

// Never runs. Node finds the named exports of a CommonJS module by scanning its source,
// and the `module.exports = Object.assign(...)` emitted above is opaque to that scan.
// This literal makes `import { SvgSpritePlugin } from 'rspack-plugin-svg-sprite'` work in ESM.
// eslint-disable-next-line no-constant-binary-expression, @typescript-eslint/no-unused-expressions
0 && (module.exports = { SvgSpritePlugin });
