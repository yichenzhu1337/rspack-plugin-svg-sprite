import { describe, it, expect, beforeAll } from '@rstest/core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

// The helper is an ES module that the bundler of the test runner cannot resolve from source, so
// the built file is loaded (`pnpm test` builds first), the same file the wrappers import.
type Interop = typeof import('../interop.mjs');
let interop: Interop['interop'];
let isExportsObject: Interop['isExportsObject'];
beforeAll(async () => {
  const url = pathToFileURL(resolve(process.cwd(), 'dist/interop.mjs')).href;
  ({ interop, isExportsObject } = (await new Function('u', 'return import(u)')(url)) as Interop);
});

// The ESM wrappers must give the same result whichever shape the host gives `ns.default`:
//   Node:  the whole `module.exports` object (its `default` is the value)
//   Bun:   `exports.default` itself, with the named exports on the namespace
// These tests fake both shapes, so the Bun branch is covered on Node as well.
describe('interop', () => {
  const make = () => {
    class Thing {}
    const helper = () => 'helper';
    return { Thing, helper };
  };

  it('detects the exports object by its nested default', () => {
    const { Thing } = make();
    expect(isExportsObject({ default: Thing })).toBe(true);
    expect(isExportsObject(Thing)).toBe(false);
    expect(isExportsObject(null)).toBe(false);
    expect(isExportsObject(undefined)).toBe(false);
    const selfRef: any = () => {};
    selfRef.default = selfRef;
    expect(isExportsObject(selfRef)).toBe(false);
  });

  it('handles a default that is the exports object (Node)', () => {
    const { Thing, helper } = make();
    const exports = { default: Thing, helper };
    const { def, exp } = interop({ default: exports, helper });
    expect(def).toBe(Thing);
    expect(exp).toBe(exports);
    expect(def.default).toBe(Thing);
    expect(def.helper).toBe(helper);
  });

  it('handles a default that is already the value (Bun)', () => {
    const { Thing, helper } = make();
    const { def, exp } = interop({ default: Thing, helper });
    expect(def).toBe(Thing);
    expect(exp.helper).toBe(helper);
    expect(def.default).toBe(Thing);
    expect(def.helper).toBe(helper);
  });

  it('gives the same result for both shapes', () => {
    const a = make();
    const b = make();
    const node = interop({ default: { default: a.Thing, helper: a.helper }, helper: a.helper });
    const bun = interop({ default: b.Thing, helper: b.helper });
    expect(Object.keys(node.def).sort()).toEqual(Object.keys(bun.def).sort());
    expect(typeof node.def.helper).toBe(typeof bun.def.helper);
  });

  it('keeps read-only own properties of a class and ignores the module.exports alias', () => {
    const { Thing } = make();
    // Bun lists `name`, `length` and `prototype` as named exports of a class module.
    const ns = {
      default: Thing,
      name: 'other',
      length: 9,
      prototype: {},
      'module.exports': Thing,
      extra: 1,
    };
    const { def } = interop(ns);
    expect(def.name).toBe('Thing');
    expect(def.extra).toBe(1);
    expect('module.exports' in def).toBe(false);
  });

  it('is idempotent when the value already carries `default` (index.ts, a second wrapper)', () => {
    const { Thing, helper } = make();
    (Thing as any).default = Thing;
    const first = interop({ default: Thing, helper });
    const second = interop({ default: Thing, helper });
    expect(first.def).toBe(second.def);
    expect(second.def.helper).toBe(helper);
    expect(second.def.default).toBe(Thing);
  });
});
