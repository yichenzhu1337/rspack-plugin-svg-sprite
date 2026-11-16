import { describe, it, expect } from '@rstest/core';
import fc from 'fast-check';
import loader, { parseRootTag } from '../../loader';
import { attrName, attrValue, check, prolog, space } from './arbitraries';

const RESERVED = new Set(['id', 'viewbox', 'width', 'height']);

const extraAttrs = fc
  .uniqueArray(fc.record({ name: attrName, value: attrValue }), {
    maxLength: 5,
    selector: (a) => a.name.toLowerCase(),
  })
  .map((attrs) => attrs.filter((a) => !RESERVED.has(a.name.toLowerCase())));

const dimension = fc.oneof(
  fc.constant(undefined),
  fc.nat({ max: 5000 }).map(String),
  fc.tuple(fc.nat({ max: 999 }), fc.nat({ max: 99 })).map(([i, f]) => i + '.' + f),
  fc.nat({ max: 5000 }).map((n) => n + 'px'),
  fc.constantFrom('100%', 'auto', '1em', '', '-4', '1e3'),
);

const viewBox = fc.oneof(
  fc.constant(undefined),
  fc.constant(''),
  fc.tuple(fc.nat(50), fc.nat(50), fc.nat(500), fc.nat(500)).map((v) => v.join(' ')),
);

const fragment = fc.constantFrom(
  '<path d="M0 0h1v1z"/>',
  '<g>',
  '</g>',
  '<title>a > b</title>',
  'text > text',
  '<!-- note -->',
  '<rect width="100" height="50"/>',
  '<svg viewBox="1 2 3 4">',
  '<text>&amp;</text>',
  '\n',
  '  ',
);

const inner = fc.array(fragment, { maxLength: 8 }).map((parts) => parts.join(''));

interface Model {
  svg: string;
  inner: string;
  viewBox: string;
  attrs: Array<[string, string]>;
}

const svgDocument: fc.Arbitrary<Model> = fc
  .record({
    pre: prolog,
    extra: extraAttrs,
    viewBox,
    width: dimension,
    height: dimension,
    inner,
    padLeft: fc.oneof(fc.constant(''), space),
    padRight: fc.oneof(fc.constant(''), space),
    trailing: fc.oneof(fc.constant(''), space),
  })
  .map((m) => {
    const parts: Array<[string, string]> = m.extra.map((a) => [a.name, a.value.raw]);
    const quoteOf = new Map(m.extra.map((a) => [a.name, a.value.quote]));
    let tag = '<svg';
    for (const [name, value] of parts) {
      const q = quoteOf.get(name)!;
      tag += ' ' + name + '=' + q + value + q;
    }
    if (m.viewBox !== undefined) tag += ' viewBox="' + m.viewBox + '"';
    if (m.width !== undefined) tag += ' width="' + m.width + '"';
    if (m.height !== undefined) tag += " height='" + m.height + "'";
    tag += '>';

    const dims = /^(\d+(?:\.\d+)?)(?:px)?$/;
    const w = dims.exec(m.width ?? '');
    const h = dims.exec(m.height ?? '');
    const expectedViewBox = m.viewBox
      ? m.viewBox
      : w && h
        ? '0 0 ' + w[1] + ' ' + h[1]
        : '0 0 24 24';

    return {
      svg: m.pre + tag + m.padLeft + m.inner + m.padRight + '</svg>' + m.trailing,
      inner: (m.padLeft + m.inner + m.padRight).trim(),
      viewBox: expectedViewBox,
      attrs: parts,
    };
  });

// `<symbol` is 3 characters longer than `<svg`, so offsets into the re-parsed text shift by 3.
const SHIFT = '<symbol'.length - '<svg'.length;

const SKIPPED = new Set(['xmlns', 'version', 'class', 'style']);

function runLoader(svg: string, options: Record<string, unknown> = {}) {
  const ctx = { resourcePath: '/icons/my-icon.svg', cacheable() {}, getOptions: () => options };
  const out: string = loader.call(ctx as any, svg);
  const match = /new SpriteSymbol\((.*)\);\n/.exec(out);
  return JSON.parse(match![1]) as { id: string; viewBox: string; content: string };
}

describe('loader round trip (property)', () => {
  it('keeps the inner content and resolves the viewBox, in inline and extract mode', () => {
    check(
      fc.property(svgDocument, fc.boolean(), (model, extract) => {
        const symbol = runLoader(model.svg, extract ? { extract: true } : {});
        expect(symbol.id).toBe('my-icon');
        expect(symbol.viewBox).toBe(model.viewBox);

        expect(symbol.content.startsWith('<symbol ')).toBe(true);
        expect(symbol.content.endsWith('</symbol>')).toBe(true);
        // Re-parse the generated <symbol> with the same XML scanner.
        const root = parseRootTag('<svg' + symbol.content.slice('<symbol'.length));
        expect(root).not.toBeNull();
        const body = symbol.content.slice(root!.end + SHIFT, -'</symbol>'.length);
        expect(body).toBe(model.inner);
        expect(root!.attrs.slice(0, 2)).toEqual([
          ['id', 'my-icon'],
          ['viewBox', model.viewBox],
        ]);
      }),
    );
  });

  it('copies the other root attributes onto the symbol with their case preserved', () => {
    check(
      fc.property(svgDocument, (model) => {
        const symbol = runLoader(model.svg);
        const root = parseRootTag('<svg' + symbol.content.slice('<symbol'.length))!;
        const expected = model.attrs
          .filter(([name]) => !name.includes(':') && !SKIPPED.has(name.toLowerCase()))
          .map(([name, value]): [string, string] => [name, value.replace(/"/g, '&quot;')]);
        expect(root.attrs.slice(2)).toEqual(expected);
      }),
    );
  });
});
