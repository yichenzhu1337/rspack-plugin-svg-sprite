import { BY_POPULATION, OTHER, FALLBACK_NAMES } from './flag-order';

// Every flag SVG in country-flag-icons/3x2.
// `@flags` is an alias (rspack.config.js).
const context = require.context('@flags', false, /^\.\/[A-Z]{2}(-[A-Z]{2,3})?\.svg$/);

const present = new Set(context.keys().map((key) => key.slice(2, -4)));
const ordered = [...BY_POPULATION, ...OTHER];
const listed = new Set(ordered);
const unlisted = [...present].filter((c) => !listed.has(c)).sort();
const codes = [...ordered.filter((c) => present.has(c)), ...unlisted];

let displayNames = null;
try {
  displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
} catch (e) {
  // Old browser: use the fallback table.
}

function nameOf(code) {
  try {
    const name = displayNames && displayNames.of(code);
    if (name && name !== code) return name;
  } catch (e) {
    // Not a code Intl knows.
  }
  return FALLBACK_NAMES[code] || code;
}

// { code, name, symbol: { id, viewBox, url } }
export const flags = codes.map((code) => ({
  code,
  name: nameOf(code),
  symbol: context(`./${code}.svg`),
}));
