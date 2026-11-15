// ESM entry for `rspack-plugin-svg-sprite/runtime/symbol`; see ../index.mts. The loader's
// generated code require()s symbol.js, so app code importing this file gets the same class.
import cjs from './symbol.js';

type Exports = typeof import('./symbol.js', { with: { 'resolution-mode': 'require' } });
const exp = cjs as unknown as Exports;

// Also carries `.default`, which is what an ESM default import gave before 1.6.0.
const SpriteSymbol: Exports['default'] & Exports = Object.assign(exp.default, exp);
type SpriteSymbol = InstanceType<Exports['default']>;

export default SpriteSymbol;
