import { describe, it, expect } from '@rstest/core';
import loader, { NAMESPACE, parseRootTag } from '../loader';

const INK = 'xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"';
const SODI = 'xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"';

function symbolFor(svg: string): string {
  let content = '';
  const ctx = {
    resourcePath: '/icons/ns.svg',
    cacheable() {},
    getOptions: () => ({ extract: true }),
    _compilation: {
      [NAMESPACE]: {
        addSymbol(data: { content: string }) {
          content = data.content;
        },
      },
    },
  };
  loader.call(ctx as any, svg);
  return content;
}

describe('namespace declarations used by the icon body', () => {
  it('copies a declaration whose prefix is used as an attribute name', () => {
    const out = symbolFor(
      '<svg xmlns="http://www.w3.org/2000/svg" ' +
        INK +
        ' viewBox="0 0 8 8"><g inkscape:label="a"/></svg>',
    );
    expect(out).toBe(
      '<symbol id="ns" viewBox="0 0 8 8" ' + INK + '><g inkscape:label="a"/></symbol>',
    );
  });

  it('copies a declaration whose prefix is used as an element name', () => {
    const open = symbolFor(
      '<svg ' + SODI + ' viewBox="0 0 8 8"><sodipodi:namedview/><path d="M0 0"/></svg>',
    );
    expect(open).toContain(SODI);
    const close = symbolFor('<svg ' + SODI + ' viewBox="0 0 8 8"><sodipodi:a></sodipodi:a></svg>');
    expect(close).toContain(SODI);
  });

  it('copies only the used declarations and escapes the prefix and value', () => {
    const out = symbolFor(
      '<svg xmlns:svg="http://www.w3.org/2000/svg" ' +
        INK +
        ' xmlns:a.b="x&quot;y" xmlns:c+d="u" viewBox="0 0 8 8">' +
        '<g inkscape:label="a" a.b:k="1"/></svg>',
    );
    expect(out).toContain(INK);
    expect(out).toContain('xmlns:a.b="x&quot;y"');
    expect(out).not.toContain('xmlns:svg');
    expect(out).not.toContain('xmlns:c+d');
  });

  it('does not treat a longer prefix or a bare word as a use', () => {
    const out = symbolFor(
      '<svg ' +
        INK +
        ' viewBox="0 0 8 8"><g data-inkscape:label="a"><text>inkscape:x</text></g></svg>',
    );
    expect(out).not.toContain('xmlns:inkscape');
  });

  it('never copies xmlns:xlink or xml', () => {
    const out = symbolFor(
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xml="x" viewBox="0 0 8 8">' +
        '<use xlink:href="#a" xml:space="preserve"/></svg>',
    );
    expect(out).toBe(
      '<symbol id="ns" viewBox="0 0 8 8"><use xlink:href="#a" xml:space="preserve"/></symbol>',
    );
  });

  it('copies a repeated declaration once', () => {
    const out = symbolFor('<svg ' + INK + ' xmlns:inkscape="other"><g inkscape:a="1"/></svg>');
    expect(out.match(/xmlns:inkscape/g)).toHaveLength(1);
  });

  it('leaves an icon without namespaces unchanged', () => {
    expect(symbolFor('<svg viewBox="0 0 8 8"><path d="M0 0"/></svg>')).toBe(
      '<symbol id="ns" viewBox="0 0 8 8"><path d="M0 0"/></symbol>',
    );
  });

  it('copies a used declaration when the root tag needs the legacy fallback', () => {
    // The unquoted attribute makes parseRootTag reject the tag.
    const svg =
      '<svg ' +
      INK +
      " xmlns:q='u' viewBox='0 0 8 8' data-x=1><g inkscape:label='a' q:k='1'/></svg>";
    expect(parseRootTag(svg)).toBeNull();
    const out = symbolFor(svg);
    expect(out).toContain(INK);
    expect(out).toContain('xmlns:q="u"');
  });

  it('copies nothing when the legacy fallback finds no root tag', () => {
    const svg = '<svg ' + INK + ' viewBox="0 0 8 8"';
    expect(parseRootTag(svg)).toBeNull();
    expect(symbolFor(svg)).toMatch(/^<symbol id="ns" viewBox="0 0 24 24">/);
  });
});
