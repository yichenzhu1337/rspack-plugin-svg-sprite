// ESM entry for `rspack-plugin-svg-sprite/rsbuild`; see index.mts.
// The source has no default export, so a default import would not type-check under
// `moduleResolution: bundler`. The namespace's `default` is `module.exports` all the same.
import * as ns from './rsbuild.js';

import type CjsView from './cjs-view.cjs';
type Exports = CjsView['rsbuild'];
// Node and Bun give the exports object as the default; a host that applies Babel-style interop to
// an `__esModule` file without a default export has no `default`, so the namespace stands in.
const loose = ns as unknown as { default?: Exports } & Exports;
const exp: Exports = loose.default?.pluginSvgSprite ? loose.default : loose;

export type { SvgSpritePluginOptions } from './rsbuild.js';
export const pluginSvgSprite: Exports['pluginSvgSprite'] = exp.pluginSvgSprite;
export const isSvgOnlyPattern: Exports['isSvgOnlyPattern'] = exp.isSvgOnlyPattern;
// No default export in the source; an ESM default import has always given the exports object.
export default exp;
