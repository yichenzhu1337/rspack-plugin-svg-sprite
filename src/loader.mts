// ESM entry for `rspack-plugin-svg-sprite/loader`; see index.mts. Bundlers that load the loader
// through `import()` get the same function as `require()` returns.
import cjs from './loader.js';

type Exports = typeof import('./loader.js', { with: { 'resolution-mode': 'require' } });
const exp = cjs as unknown as Exports;

// The default export is the loader function. Before 1.6.0 an ESM default import gave the whole
// CommonJS exports object, so the function also carries those properties.
const loader: Exports['default'] & Exports = Object.assign(exp.default, exp);

export const NAMESPACE: Exports['NAMESPACE'] = exp.NAMESPACE;
export const parseRootTag: Exports['parseRootTag'] = exp.parseRootTag;
export const parseViewBox: Exports['parseViewBox'] = exp.parseViewBox;
export const extractSvgInner: Exports['extractSvgInner'] = exp.extractSvgInner;
export const extractSvgAttrs: Exports['extractSvgAttrs'] = exp.extractSvgAttrs;
export const generateSymbolId: Exports['generateSymbolId'] = exp.generateSymbolId;
export const legacy: Exports['legacy'] = exp.legacy;
export default loader;
