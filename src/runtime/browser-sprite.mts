// ESM entry for `rspack-plugin-svg-sprite/runtime/browser-sprite`; see ../index.mts. The
// loader's generated code require()s browser-sprite.js, so the page keeps a single sprite.
import cjs from './browser-sprite.js';

type Exports = typeof import('./browser-sprite.js', { with: { 'resolution-mode': 'require' } });
const exp = cjs as unknown as Exports;

// Also carries `.default`, which is what an ESM default import gave before 1.6.0.
const sprite: Exports['default'] & Exports = Object.assign(exp.default, exp);

export default sprite;
