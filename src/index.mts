// ESM entry points (`*.mts` -> `dist/*.mjs`) are thin wrappers around the CommonJS build. There
// is one implementation, so a config that imports the plugin, the loader that a bundler
// require()s, and app code that imports the runtime all share the same module instances.
//
// A wrapper reads the CommonJS file through a namespace import. Node and Bun (and bundlers) give
// `ns.default` different things for the same file, which interop.mts sorts out. Under
// `moduleResolution: bundler` (the test type-check) TypeScript models the import differently, so
// every wrapper reads the exports through the `require` view of the module's types.
import * as ns from './index.js';
import { interop } from './interop.mjs';

import type CjsView from './cjs-view.cjs';
type Exports = CjsView['index'];
const SvgSpritePlugin: Exports = interop(ns).def;

export { SvgSpritePlugin };
export default SvgSpritePlugin;
