import { describe, it, expect } from '@rstest/core';
import fc from 'fast-check';
import { parseRootTag } from '../../loader';
import { check, rootTag } from './arbitraries';

describe('parseRootTag (property)', () => {
  it('returns exactly the generated attributes, in order, with names in original case', () => {
    check(
      fc.property(rootTag(), fc.string({ maxLength: 40 }), (root, rest) => {
        const parsed = parseRootTag(root.text + rest);
        expect(parsed).not.toBeNull();
        expect(parsed!.attrs).toEqual(root.attrs);
        expect(parsed!.end).toBe(root.text.length);
      }),
    );
  });

  it('ignores `<svg` text inside comments before the root', () => {
    check(
      fc.property(rootTag(), (root) => {
        const parsed = parseRootTag('<!-- <svg viewBox="9 9 9 9"> -->' + root.text);
        expect(parsed!.attrs).toEqual(root.attrs);
      }),
    );
  });

  it('returns null when the open tag is cut off before its closing `>`', () => {
    check(
      fc.property(rootTag(), (root) => {
        // Drop the final `>`: the tag is no longer terminated.
        expect(parseRootTag(root.text.slice(0, -1))).toBeNull();
      }),
    );
  });
});
