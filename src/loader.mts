// ESM entry for `rspack-plugin-svg-sprite/loader`; see index.mts. Bundlers that load the loader
// through `import()` get the same function as `require()` returns.
import * as ns from './loader.js';
import { interop } from './interop.mjs';

import type { CjsView } from './cjs-view.cjs';
type Exports = CjsView['loader'];
const { def, exp } = interop(ns) as { def: Exports['default'] & Exports; exp: Exports };

// The default export is the loader function. Before 1.6.0 an ESM default import gave the whole
// CommonJS exports object, so the function also carries those properties.
const loader: Exports['default'] & Exports = def;

export const NAMESPACE: Exports['NAMESPACE'] = exp.NAMESPACE;
export const parseRootTag: Exports['parseRootTag'] = exp.parseRootTag;
export const parseViewBox: Exports['parseViewBox'] = exp.parseViewBox;
export const extractSvgInner: Exports['extractSvgInner'] = exp.extractSvgInner;
export const extractSvgAttrs: Exports['extractSvgAttrs'] = exp.extractSvgAttrs;
export const generateSymbolId: Exports['generateSymbolId'] = exp.generateSymbolId;
export const legacy: Exports['legacy'] = exp.legacy;
export default loader;
