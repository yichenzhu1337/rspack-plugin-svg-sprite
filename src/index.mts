// ESM entry points (`*.mts` -> `dist/*.mjs`) are thin wrappers around the CommonJS build. There
// is one implementation, so a config that imports the plugin, the loader that a bundler
// require()s, and app code that imports the runtime all share the same module instances.
//
// `import cjs from './x.js'` gives the CommonJS `module.exports` object in Node and in bundlers.
// Under `moduleResolution: bundler` (the test type-check) TypeScript models it differently, so
// every wrapper reads the exports through the `require` view of the module's types.
import cjs from './index.js';

type Exports = typeof import('./index.js', { with: { 'resolution-mode': 'require' } });
const SvgSpritePlugin = cjs as unknown as Exports;

export { SvgSpritePlugin };
export default SvgSpritePlugin;
