import { describe, it, expect } from '@rstest/core';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import loader, {
  extractSvgAttrs,
  extractSvgInner,
  legacy,
  parseRootTag,
  parseViewBox,
} from '../loader';

const ROOT = process.cwd();
const nodeRequire = createRequire(path.join(ROOT, 'package.json'));

/** Runs the loader in inline mode and returns the generated `<symbol>` markup. */
function symbolOf(svgContent: string): string {
  const ctx = { resourcePath: '/repo/icons/icon.svg', getOptions: () => ({}), _compilation: {} };
  const output = loader.call(ctx as any, svgContent);
  const match = /"content":("(?:[^"\\]|\\.)*")/.exec(output);
  return JSON.parse(match![1]);
}

function attrsOf(svgContent: string): Record<string, string> {
  const root = parseRootTag(svgContent);
  const map: Record<string, string> = {};
  for (const [name, value] of root!.attrs) map[name] = value;
  return map;
}

describe('parseRootTag', () => {
  it('reads attributes in order with names and values exactly as written', () => {
    const root = parseRootTag('<svg viewBox="0 0 24 24" preserveAspectRatio="none">x</svg>');
    expect(root!.attrs).toEqual([
      ['viewBox', '0 0 24 24'],
      ['preserveAspectRatio', 'none'],
    ]);
    expect(root!.end).toBe('<svg viewBox="0 0 24 24" preserveAspectRatio="none">'.length);
  });

  it('accepts a root tag without attributes', () => {
    expect(parseRootTag('<svg>x</svg>')).toEqual({ attrs: [], end: 5 });
  });

  it('accepts single quotes, multi-line tags, tabs and spaces around the equals sign', () => {
    const svg = '<svg\n\tviewBox = \'0 0 8 8\'\r\n  fill= "none"\n>x</svg>';
    expect(attrsOf(svg)).toEqual({ viewBox: '0 0 8 8', fill: 'none' });
  });

  it('does not end the tag at a ">" inside a quoted value', () => {
    expect(attrsOf('<svg data-x="a > b" viewBox="0 0 10 10">x</svg>')).toEqual({
      'data-x': 'a > b',
      viewBox: '0 0 10 10',
    });
  });

  it('keeps the other quote character inside a value', () => {
    expect(attrsOf('<svg aria-label="John\'s icon">x</svg>')).toEqual({
      'aria-label': "John's icon",
    });
    expect(attrsOf('<svg aria-label=\'say "hi"\'>x</svg>')).toEqual({
      'aria-label': 'say "hi"',
    });
  });

  it('matches the tag name case-insensitively, like v1', () => {
    expect(attrsOf('<SVG viewBox="0 0 1 1">x</SVG>')).toEqual({ viewBox: '0 0 1 1' });
  });

  it('skips "<svg" text inside a comment that precedes the root', () => {
    const svg = '<!-- old: <svg viewBox="0 0 1 1"> --><svg viewBox="0 0 10 10">x</svg>';
    expect(attrsOf(svg)).toEqual({ viewBox: '0 0 10 10' });
  });

  it('still finds the root after an unterminated comment', () => {
    expect(attrsOf('<!-- never closed <svg viewBox="0 0 3 3">x</svg>')).toEqual({
      viewBox: '0 0 3 3',
    });
  });

  it('skips an XML prolog, a generator comment and a DOCTYPE', () => {
    const svg =
      '<?xml version="1.0" encoding="utf-8"?>\n' +
      '<!-- Generator: Adobe Illustrator 24.0.0, SVG Export Plug-In . SVG Version: 6.00 -->\n' +
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
      '<svg version="1.1" id="Layer_1" x="0px" y="0px"\n\t viewBox="0 0 24 24" xml:space="preserve">x</svg>';
    expect(attrsOf(svg)).toEqual({
      version: '1.1',
      id: 'Layer_1',
      x: '0px',
      y: '0px',
      viewBox: '0 0 24 24',
      'xml:space': 'preserve',
    });
  });

  it.each([
    ['no svg element', '<div>not an svg</div>'],
    ['empty input', ''],
    ['tag name is not svg', '<svgfoo viewBox="0 0 1 1">x</svgfoo>'],
    ['attribute without a value', '<svg hidden viewBox="0 0 1 1">x</svg>'],
    ['unquoted value', '<svg width=24>x</svg>'],
    ['unbalanced quote', '<svg foo=" viewBox="0 0 10 10">x</svg>'],
    ['unterminated value', '<svg viewBox="0 0 1 1>x</svg>'],
    ['attributes not separated by whitespace', '<svg a="1"b="2">x</svg>'],
    ['self-closing root', '<svg viewBox="0 0 1 1"/>'],
    ['input ends inside the tag', '<svg viewBox="0 0 1 1" '],
    ['input ends after a name', '<svg viewBox'],
  ])('returns null for a root tag that is not well-formed XML: %s', (_label, svg) => {
    expect(parseRootTag(svg)).toBeNull();
  });
});

describe('fixes for root tags v1 mis-parsed', () => {
  it('keeps the case of attribute names such as preserveAspectRatio', () => {
    const symbol = symbolOf(
      '<svg viewBox="0 0 10 10" preserveAspectRatio="xMidYMid slice"><path d="M0 0"/></svg>',
    );
    expect(symbol).toBe(
      '<symbol id="icon" viewBox="0 0 10 10" preserveAspectRatio="xMidYMid slice"><path d="M0 0"/></symbol>',
    );
  });

  it('does not truncate a value at an apostrophe', () => {
    expect(symbolOf('<svg viewBox="0 0 10 10" aria-label="John\'s icon"><g/></svg>')).toBe(
      '<symbol id="icon" viewBox="0 0 10 10" aria-label="John\'s icon"><g/></symbol>',
    );
  });

  it('does not truncate the root tag at a ">" inside a value', () => {
    expect(symbolOf('<svg data-x="a > b" viewBox="0 0 10 10" fill="red"><g/></svg>')).toBe(
      '<symbol id="icon" viewBox="0 0 10 10" data-x="a > b" fill="red"><g/></symbol>',
    );
  });

  it('escapes a double quote that came from a single-quoted value', () => {
    expect(symbolOf("<svg viewBox='0 0 10 10' aria-label='say \"hi\"'><g/></svg>")).toBe(
      '<symbol id="icon" viewBox="0 0 10 10" aria-label="say &quot;hi&quot;"><g/></symbol>',
    );
  });

  it('reads attributes written with spaces around the equals sign', () => {
    expect(symbolOf('<svg viewBox = "0 0 10 10" fill = "red"><g/></svg>')).toBe(
      '<symbol id="icon" viewBox="0 0 10 10" fill="red"><g/></symbol>',
    );
  });

  it('does not read stroke-width as the width when deriving a viewBox', () => {
    expect(parseViewBox('<svg stroke-width="2" height="24"><g/></svg>')).toBe('0 0 24 24');
    expect(parseViewBox('<svg stroke-width="2" width="30" height="24"><g/></svg>')).toBe(
      '0 0 30 24',
    );
  });

  it('does not read a viewBox out of another attribute', () => {
    expect(parseViewBox('<svg data-viewBox="0 0 1 1" width="8" height="6"><g/></svg>')).toBe(
      '0 0 8 6',
    );
  });

  it('ignores "<svg" text inside a leading comment', () => {
    expect(
      symbolOf('<!-- old: <svg viewBox="0 0 1 1"> --><svg viewBox="0 0 10 10"><g/></svg>'),
    ).toBe('<symbol id="icon" viewBox="0 0 10 10"><g/></symbol>');
  });

  it('accepts whitespace before the ">" of the closing tag', () => {
    expect(extractSvgInner('<svg viewBox="0 0 10 10"><g/></svg >')).toBe('<g/>');
  });

  it('passes the inner content through untouched (comments, CDATA, nested svg)', () => {
    const inner =
      '<!-- note --><style><![CDATA[ .a{fill:red} ]]></style><svg viewBox="0 0 1 1"><rect/></svg>';
    expect(extractSvgInner('<svg viewBox="0 0 10 10">\n  ' + inner + '\n</svg>\n')).toBe(inner);
  });
});

describe('behavior that is deliberately unchanged from v1', () => {
  it('still defaults the viewBox to "0 0 24 24" when there is no viewBox and no size', () => {
    expect(parseViewBox('<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>')).toBe('0 0 24 24');
    expect(parseViewBox('<svg width="100%" height="100%"><g/></svg>')).toBe('0 0 24 24');
    expect(parseViewBox('<svg viewBox="" width="1em" height="1em"><g/></svg>')).toBe('0 0 24 24');
  });

  it('still derives the viewBox from plain, px and decimal sizes', () => {
    expect(parseViewBox('<svg width="48" height="32"><g/></svg>')).toBe('0 0 48 32');
    expect(parseViewBox('<svg width="48px" height="32.5px"><g/></svg>')).toBe('0 0 48 32.5');
  });

  it('extractSvgAttrs still returns lowercased names (its exported v1 contract)', () => {
    expect(
      extractSvgAttrs('<svg viewBox="0 0 1 1" preserveAspectRatio="none" Fill="red"><g/></svg>'),
    ).toEqual({ viewbox: '0 0 1 1', preserveaspectratio: 'none', fill: 'red' });
  });

  it('still drops xmlns, version, class, style, namespaced attrs, id, width and height', () => {
    const symbol = symbolOf(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
        'version="1.1" id="Layer_1" class="c" style="x:y" xml:space="preserve" width="24" ' +
        'height="24" viewBox="0 0 24 24" fill="none"><g/></svg>',
    );
    expect(symbol).toBe('<symbol id="icon" viewBox="0 0 24 24" fill="none"><g/></symbol>');
  });
});

describe('malformed root tags run the untouched v1 code path', () => {
  const MALFORMED = [
    '<svg hidden viewBox="0 0 10 10" fill="red" xml:space="preserve" class="x"><g/></svg>',
    '<svg hidden width="20" height="10" stroke="blue"><g/></svg>',
    '<svg hidden><g/></svg>',
    '<svg foo=" viewBox="0 0 10 10"><g/></svg>',
    '<svg viewBox="0 0 10 10"/>',
    '<svg width=24 height=24><g/></svg>',
    '<svgfoo viewBox="0 0 1 1"><g/></svgfoo>',
  ];

  it.each(MALFORMED)('%s', (svg) => {
    expect(parseRootTag(svg)).toBeNull();
    expect(parseViewBox(svg)).toBe(legacy.parseViewBox(svg));
    expect(extractSvgInner(svg)).toBe(legacy.extractSvgInner(svg));
    expect(extractSvgAttrs(svg)).toEqual(legacy.extractSvgAttrs(svg));
  });

  it('a well-formed open tag without a closing tag keeps the v1 result', () => {
    const svg = '<svg viewBox="0 0 10 10"><g/>';
    expect(parseRootTag(svg)).not.toBeNull();
    expect(extractSvgInner(svg)).toBe(legacy.extractSvgInner(svg));
    expect(extractSvgInner(svg)).toBe(svg);
  });

  it('pins the v1 outputs for these inputs', () => {
    expect(legacy.parseViewBox(MALFORMED[0])).toBe('0 0 10 10');
    expect(legacy.extractSvgAttrs(MALFORMED[0])).toEqual({ viewbox: '0 0 10 10', fill: 'red' });
    expect(legacy.parseViewBox(MALFORMED[1])).toBe('0 0 20 10');
    expect(legacy.parseViewBox(MALFORMED[2])).toBe('0 0 24 24');
    expect(legacy.extractSvgInner(MALFORMED[2])).toBe('<g/>');
    expect(legacy.extractSvgInner('no wrapper')).toBe('no wrapper');
    expect(legacy.extractSvgAttrs('<div/>')).toEqual({});
  });
});

describe('equivalence with v1 on input v1 already parsed correctly', () => {
  it('3000 generated well-formed root tags give identical helper results', () => {
    let seed = 42;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const names = [
      'fill',
      'stroke',
      'viewBox',
      'width',
      'height',
      'xmlns',
      'class',
      'style',
      'version',
      'id',
      'role',
      'opacity',
      'xml:space',
      'xmlns:xlink',
      'data-name',
      'stroke-linecap',
      'aria-hidden',
      'preserveAspectRatio',
    ];
    const values = [
      'none',
      'currentColor',
      '0 0 24 24',
      '24',
      '16px',
      '1.5',
      '100%',
      'http://www.w3.org/2000/svg',
      'icon a-b',
      '',
      '#fff',
      'round',
      '1em',
    ];
    const separators = [' ', '\n  ', '\t'];
    const inners = ['<path d="M0 0"/>', '\n  <g><circle r="2"/></g>\n', '', '<svg><rect/></svg>'];
    const prologs = ['', '<?xml version="1.0" encoding="UTF-8"?>\n', '<!-- Generator: X -->\n'];

    for (let i = 0; i < 3000; i++) {
      const used: Record<string, boolean> = {};
      let tag = '<svg';
      for (let k = rnd(7); k > 0; k--) {
        const name = names[rnd(names.length)];
        if (used[name]) continue;
        used[name] = true;
        const quote = rnd(2) ? '"' : "'";
        tag += separators[rnd(3)] + name + '=' + quote + values[rnd(values.length)] + quote;
      }
      const svg = prologs[rnd(3)] + tag + '>' + inners[rnd(4)] + '</svg>' + (rnd(2) ? '\n' : '');

      expect(parseRootTag(svg)).not.toBeNull();
      expect(parseViewBox(svg)).toBe(legacy.parseViewBox(svg));
      expect(extractSvgInner(svg)).toBe(legacy.extractSvgInner(svg));
      expect(extractSvgAttrs(svg)).toEqual(legacy.extractSvgAttrs(svg));
    }
  });
});

describe('agreement with a real XML parser (htmlparser2, dev-only)', () => {
  const htmlparser2 = nodeRequire('htmlparser2');

  function realIcons(): string[] {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir)) {
        if (entry === 'node_modules' || entry === 'dist') continue;
        // UNDER REVIEW: a self-closing root takes the v1 fallback (see corpus.test.ts).
        if (entry === 'messy--empty-svg.svg') continue;
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith('.svg')) files.push(full);
      }
    };
    walk(path.join(ROOT, 'examples'));
    walk(path.join(ROOT, 'src/__tests__/fixtures'));
    return files;
  }

  const synthetic = [
    '<svg viewBox="0 0 10 10" preserveAspectRatio="xMidYMid slice"><path d="M0 0"/></svg>',
    '<svg viewBox="0 0 10 10" aria-label="John\'s icon"><path d="M0 0"/></svg>',
    '<svg data-x="a > b" viewBox="0 0 10 10" fill="red"><path d="M0 0"/></svg>',
    "<svg viewBox='0 0 10 10' aria-label='say \"hi\"'><path d='M0 0'/></svg>",
    '<svg viewBox = "0 0 10 10" fill = "red"><path d="M0 0"/></svg>',
    '<!-- old: <svg viewBox="0 0 1 1"> --><svg viewBox="0 0 10 10"><path d="M0 0"/></svg>',
    '<?xml version="1.0"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x.dtd">\n<svg\n  viewBox="0 0 2 2"\n  xml:space="preserve">\n<g/>\n</svg>\n',
    '<svg viewBox="0 0 10 10"><style><![CDATA[ .a{fill:red} ]]></style><path class="a"/></svg>',
  ];

  function check(label: string, content: string) {
    const root = parseRootTag(content);
    expect(root, label + ' must be parsed by the strict path').not.toBeNull();

    const doc = htmlparser2.parseDocument(content, {
      xmlMode: true,
      decodeEntities: false,
      lowerCaseTags: false,
      lowerCaseAttributeNames: false,
      withStartIndices: true,
      withEndIndices: true,
    });
    const element = doc.children.find((node: any) => node.type === 'tag');

    const mine: Record<string, string> = {};
    for (const [name, value] of root!.attrs) if (!(name in mine)) mine[name] = value;
    expect(mine, label + ' attributes').toEqual(element.attribs);

    const kids = element.children;
    const expectedInner = kids.length
      ? content.slice(kids[0].startIndex, kids[kids.length - 1].endIndex + 1).trim()
      : '';
    expect(extractSvgInner(content), label + ' inner content').toBe(expectedInner);
  }

  it('agrees on every real icon in the repository', () => {
    const files = realIcons();
    expect(files.length).toBeGreaterThanOrEqual(30);
    for (const file of files) check(path.relative(ROOT, file), fs.readFileSync(file, 'utf8'));
  });

  it('agrees on the inputs v1 mis-parsed', () => {
    synthetic.forEach((content, index) => check('synthetic #' + index, content));
  });
});
