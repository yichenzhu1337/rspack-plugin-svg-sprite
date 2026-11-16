// ESM entry for `rspack-plugin-svg-sprite/runtime/browser-sprite`; see ../index.mts. The
// loader's generated code require()s browser-sprite.js, so the page keeps a single sprite.
import * as ns from './browser-sprite.js';
import { interop } from '../interop.mjs';

import type { CjsView } from '../cjs-view.cjs';
type Exports = CjsView['browserSprite'];

// Also carries `.default`, which is what an ESM default import gave before 1.6.0.
const sprite: Exports['default'] & Exports = interop(ns).def;

export default sprite;
