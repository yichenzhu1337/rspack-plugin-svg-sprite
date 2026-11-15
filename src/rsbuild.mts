// ESM entry for `rspack-plugin-svg-sprite/rsbuild`; see index.mts.
// The source has no default export, so a default import would not type-check under
// `moduleResolution: bundler`. The namespace's `default` is `module.exports` all the same.
import * as ns from './rsbuild.js';

type Exports = typeof import('./rsbuild.js', { with: { 'resolution-mode': 'require' } });
const exp = (ns as unknown as { default: Exports }).default;

export type { SvgSpritePluginOptions } from './rsbuild.js';
export const pluginSvgSprite: Exports['pluginSvgSprite'] = exp.pluginSvgSprite;
export const isSvgOnlyPattern: Exports['isSvgOnlyPattern'] = exp.isSvgOnlyPattern;
// No default export in the source; an ESM default import has always given the exports object.
export default exp;
