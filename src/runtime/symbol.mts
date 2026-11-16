// ESM entry for `rspack-plugin-svg-sprite/runtime/symbol`; see ../index.mts. The loader's
// generated code require()s symbol.js, so app code importing this file gets the same class.
import * as ns from './symbol.js';
import { interop } from '../interop.mjs';

import type CjsView from '../cjs-view.cjs';
type Exports = CjsView['symbol'];

// Also carries `.default`, which is what an ESM default import gave before 1.6.0.
const SpriteSymbol: Exports['default'] & Exports = interop(ns).def;
type SpriteSymbol = InstanceType<Exports['default']>;

export default SpriteSymbol;
