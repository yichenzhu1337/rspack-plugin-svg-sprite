// ESM entry for `rspack-plugin-svg-sprite/plugin`; see index.mts.
import cjs from './plugin.js';

type Exports = typeof import('./plugin.js', { with: { 'resolution-mode': 'require' } });
const exp = cjs as unknown as Exports;

// The default export is the class. Before 1.6.0 an ESM default import gave the whole CommonJS
// exports object, so the class also carries those properties (`.default`, the named exports).
const SvgSpritePlugin: Exports['default'] & Exports = Object.assign(exp.default, exp);
type SvgSpritePlugin = InstanceType<Exports['default']>;

export const FallbackRawSource: Exports['FallbackRawSource'] = exp.FallbackRawSource;
export const resolveRawSource: Exports['resolveRawSource'] = exp.resolveRawSource;
export default SvgSpritePlugin;
