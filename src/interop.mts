// Shared by the ESM wrappers (`*.mts`). Not part of the public API.
//
// A wrapper does `import * as ns from './x.js'`, and what `ns.default` holds depends on the host:
//   - Node, and bundlers for a CommonJS file without `__esModule`: the whole `module.exports`
//     object, whose `default` is the value the file exports.
//   - Bun, and bundlers applying Babel-style interop to an `__esModule` file: `exports.default`
//     itself, with the named exports on the namespace.
// Both shapes resolve to the same object that `require()` returns, so there is only one instance.
// No Node built-ins are used: the runtime wrappers are bundled into browser code.

type Loose = any;

/** `value` is the exports object when it nests the exported value under its own `default`. */
export function isExportsObject(value: Loose): boolean {
  return value != null && value.default !== undefined && value.default !== value;
}

/**
 * Returns the exported value (`def`) and the object that holds the named exports (`exp`) for
 * either shape. `def` also carries the named exports and `.default`, as the default import of a
 * CommonJS file did before 1.6.0.
 */
export function interop(ns: Loose): { def: Loose; exp: Loose } {
  const d = ns.default;
  const nested = isExportsObject(d);
  const def = nested ? d.default : d;
  // `d.default === d` (set by an earlier wrapper or by index.ts) is not the exports object, so
  // the named exports come from the namespace.
  const { 'module.exports': _alias, ...named } = ns;
  const exp = nested ? d : named;
  // Bun lists a class's own `name`, `length` and `prototype` as named exports of a CommonJS
  // module that is the class, and they are read-only: copy only what `def` does not have.
  for (const key of Object.keys(exp)) if (!(key in def)) def[key] = exp[key];
  return { def, exp };
}
