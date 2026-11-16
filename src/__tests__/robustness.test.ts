import { describe, it, expect, beforeAll, afterAll } from '@rstest/core';
import fs from 'fs';
import path from 'path';
import { Parser } from 'htmlparser2';
import loader, { NAMESPACE } from '../loader';
import SvgSpritePlugin from '../plugin';
import {
  ALL_BUNDLERS,
  LOADER,
  SvgSpritePlugin as BuiltPlugin,
  makeProject,
  nodeRequire,
  removeProject,
  symbolIds,
} from './integration/helpers';
import type { Bundler } from './integration/helpers';

/**
 * Robustness corpus. Every case decides the CORRECT outcome from the README: a valid module and
 * symbol, or a clear build error. Never an unhelpful crash, never a hang, never corrupt sprite
 * markup. Cases that expose a real defect stay as `it.skip` with the minimal reproduction.
 */

const RSPACK_1: Bundler = ALL_BUNDLERS[0]!;
const XMLNS = 'xmlns="http://www.w3.org/2000/svg"';

// ---------------------------------------------------------------------------------------------
// Well-formedness check (htmlparser2 in XML mode, plus the checks it is too lenient to make)
// ---------------------------------------------------------------------------------------------

// Drops CDATA sections and comments in one forward scan (no pattern is applied twice).
function stripCdataAndComments(xml: string): string {
  const kept: string[] = [];
  let from = 0;
  while (from < xml.length) {
    const open = xml.indexOf('<!', from);
    if (open === -1) break;
    const close = xml.startsWith('<![CDATA[', open)
      ? ']]>'
      : xml.startsWith('<!--', open)
        ? '-->'
        : '';
    if (!close) {
      kept.push(xml.slice(from, open + 2));
      from = open + 2;
      continue;
    }
    kept.push(xml.slice(from, open));
    const end = xml.indexOf(close, open);
    if (end === -1) return kept.join('');
    from = end + close.length;
  }
  kept.push(xml.slice(from));
  return kept.join('');
}

function xmlProblems(xml: string): string[] {
  const problems: string[] = [];
  const stack: string[] = [];
  const parser = new Parser(
    {
      onopentag(name) {
        stack.push(name);
      },
      onclosetag(name, implied) {
        // htmlparser2 reports `<a/>` as an implied close too, so look at the source text.
        const selfClosed = xml.slice(parser.endIndex - 1, parser.endIndex + 1) === '/>';
        if (implied && !selfClosed) problems.push('implied close of <' + name + '>');
        if (stack.pop() !== name) problems.push('mismatched close of <' + name + '>');
      },
      onattribute(name, value) {
        if (!/^[A-Za-z_][\w.:-]*$/.test(name)) problems.push('bad attribute name ' + name);
        if (value.includes('<')) problems.push('raw "<" in attribute ' + name);
      },
      onerror(err) {
        problems.push(err.message);
      },
    },
    // Raw attribute text, so an escaped `&lt;` is not reported as a bare `<`.
    { xmlMode: true, decodeEntities: false },
  );
  parser.write(xml);
  parser.end();
  if (stack.length > 0) problems.push('unclosed: ' + stack.join(','));

  const text = stripCdataAndComments(xml);
  const entity = text.match(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)[^\s<]{0,12}/g);
  if (entity) problems.push('bare or undeclared entity: ' + entity.join(' '));
  return problems;
}

describe('well-formedness checker', () => {
  it('accepts a sprite and rejects the usual corruption', () => {
    expect(
      xmlProblems('<svg ' + XMLNS + '><defs><symbol id="a"><path d="M0"/></symbol></defs></svg>'),
    ).toEqual([]);
    expect(xmlProblems('<svg><symbol id="a"b"></symbol></svg>')).not.toEqual([]);
    expect(xmlProblems('<svg><symbol id="a&b"></symbol></svg>')).not.toEqual([]);
    expect(xmlProblems('<svg><symbol id="a"><path></symbol></svg>')).not.toEqual([]);
    expect(xmlProblems('<svg><symbol id="a">')).not.toEqual([]);
    expect(xmlProblems('<svg><style><![CDATA[a > b & c]]></style></svg>')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Real-build harness
// ---------------------------------------------------------------------------------------------

interface Outcome {
  errors: string[];
  warnings: string[];
  consoleWarnings: string[];
  sprite: string | null;
  icons: Record<string, any>;
  ms: number;
  dir: string;
}

async function buildProject(
  bundler: Bundler,
  files: Record<string, string | Buffer>,
  extract: boolean,
  loaderOptions: Record<string, unknown> = {},
  entrySource?: string,
): Promise<Outcome> {
  const names = Object.keys(files).filter((f) => f.endsWith('.svg'));
  const entry =
    entrySource ??
    names.map((f, i) => 'import i' + i + " from './" + f + "';").join('\n') +
      '\nexport default { ' +
      names.map((f, i) => JSON.stringify(f) + ': i' + i).join(', ') +
      ' };\n';
  const dir = makeProject({ ...(files as Record<string, string>), 'index.js': entry });
  for (const f of Object.keys(files)) {
    // makeProject writes strings; re-write Buffers (BOM tests) exactly.
    if (Buffer.isBuffer(files[f])) fs.writeFileSync(path.join(dir, f), files[f] as Buffer);
  }

  const consoleWarnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    consoleWarnings.push(args.map(String).join(' '));
  };
  const started = Date.now();
  try {
    const result = await new Promise<{ errors: string[]; warnings: string[] }>(
      (resolve, reject) => {
        const compiler = bundler.impl({
          mode: 'production',
          devtool: false,
          target: 'node',
          context: dir,
          entry: './index.js',
          output: {
            path: path.join(dir, 'out'),
            filename: 'bundle.js',
            library: { type: 'commonjs2' },
            publicPath: '/assets/',
          },
          module: {
            rules: [
              {
                test: /\.svg$/,
                type: 'javascript/auto',
                loader: LOADER,
                options: { extract, ...loaderOptions },
              },
            ],
          },
          plugins: extract ? [new BuiltPlugin()] : [],
        });
        compiler.run((err: Error | null, stats: any) => {
          compiler.close(() => {
            if (err) return reject(err);
            const json = stats.toJson({ all: false, errors: true, warnings: true });
            resolve({
              errors: (json.errors || []).map((e: any) => String(e.message || e)),
              warnings: (json.warnings || []).map((w: any) => String(w.message || w)),
            });
          });
        });
      },
    );
    const spriteFile = path.join(dir, 'out', 'sprite.svg');
    const bundleFile = path.join(dir, 'out', 'bundle.js');
    let icons: Record<string, any> = {};
    if (fs.existsSync(bundleFile)) {
      const mod = nodeRequire(bundleFile);
      icons = mod.default || mod;
    }
    return {
      ...result,
      consoleWarnings,
      sprite: fs.existsSync(spriteFile) ? fs.readFileSync(spriteFile, 'utf8') : null,
      icons,
      ms: Date.now() - started,
      dir,
    };
  } finally {
    console.warn = original;
  }
}

// ---------------------------------------------------------------------------------------------
// Corpus of valid inputs: one build per bundler and mode
// ---------------------------------------------------------------------------------------------

const PROLOG =
  '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
  '<!-- Generator: decoy <svg viewBox="9 9 9 9"> in a comment -->\n' +
  '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
  '<!-- second comment -->\n' +
  '<svg ' +
  XMLNS +
  ' viewBox="0 0 7 7"><path d="M0 0h7v7z"/></svg>\n' +
  '<!-- trailing comment -->\n';

const CORPUS: Record<string, string | Buffer> = {
  'crlf.svg':
    '<svg ' +
    XMLNS +
    '\r\n     viewBox="0 0 10 10"\r\n     fill="none">\r\n  <path d="M0 0"/>\r\n</svg>\r\n',
  'bom.svg': Buffer.from(
    '\uFEFF<svg ' + XMLNS + ' viewBox="0 0 11 11"><path d="M0 0"/></svg>\n',
    'utf8',
  ),
  'prolog.svg': PROLOG,
  'with space.svg': '<svg ' + XMLNS + ' viewBox="0 0 1 1"><path d="M0 0"/></svg>',
  'ünï-日本.svg': '<svg ' + XMLNS + ' viewBox="0 0 2 2"><path d="M0 0"/></svg>',
  'dotted.name.v2.svg': '<svg ' + XMLNS + ' viewBox="0 0 3 3"><path d="M0 0"/></svg>',
  'UPPER.Case.svg': '<svg ' + XMLNS + ' viewBox="0 0 4 4"><path d="M0 0"/></svg>',
  '1-digit.svg': '<svg ' + XMLNS + ' viewBox="0 0 5 5"><path d="M0 0"/></svg>',
  'nested.svg':
    '<svg ' +
    XMLNS +
    ' viewBox="0 0 20 20"><svg x="2" y="2" width="8" height="8" viewBox="0 0 4 4"><svg viewBox="0 0 2 2"><path d="M0 0"/></svg></svg></svg>',
  'container.svg':
    '<svg ' +
    XMLNS +
    ' viewBox="0 0 12 12">' +
    '<defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs>' +
    '<style>.a > .b { fill: url(#g) }</style>' +
    '<symbol id="inner" viewBox="0 0 3 3"><path d="M0 0"/></symbol>' +
    '<script>var x = 1 &lt; 2;</script>' +
    '<use href="#inner"/></svg>',
  'dupids.svg':
    '<svg ' +
    XMLNS +
    ' viewBox="0 0 6 6"><path id="p" d="M0 0"/><path id="p" d="M1 1"/><g id="dupids"><path d="M2 2"/></g></svg>',
  'entities.svg':
    '<svg ' +
    XMLNS +
    ' viewBox="0 0 8 8"><title>Fish &amp; chips &lt;3 &#169; &#x263A;</title>' +
    '<style><![CDATA[ .a > .b { content: "&"; } ]]></style><path d="M0 0"/></svg>',
  'wrapper.svg': '<foo><svg viewBox="0 0 9 9"><path d="M0 0"/></svg></foo>',
};

const EXPECTED: Record<string, { id: string; viewBox: string }> = {
  'crlf.svg': { id: 'crlf', viewBox: '0 0 10 10' },
  'bom.svg': { id: 'bom', viewBox: '0 0 11 11' },
  'prolog.svg': { id: 'prolog', viewBox: '0 0 7 7' },
  'with space.svg': { id: 'with space', viewBox: '0 0 1 1' },
  'ünï-日本.svg': { id: 'ünï-日本', viewBox: '0 0 2 2' },
  'dotted.name.v2.svg': { id: 'dotted.name.v2', viewBox: '0 0 3 3' },
  'UPPER.Case.svg': { id: 'UPPER.Case', viewBox: '0 0 4 4' },
  '1-digit.svg': { id: '1-digit', viewBox: '0 0 5 5' },
  'nested.svg': { id: 'nested', viewBox: '0 0 20 20' },
  'container.svg': { id: 'container', viewBox: '0 0 12 12' },
  'dupids.svg': { id: 'dupids', viewBox: '0 0 6 6' },
  'entities.svg': { id: 'entities', viewBox: '0 0 8 8' },
  'wrapper.svg': { id: 'wrapper', viewBox: '0 0 9 9' },
};

for (const bundler of ALL_BUNDLERS) {
  for (const extract of [false, true]) {
    describe('corpus: ' + bundler.name + ', ' + (extract ? 'extract' : 'inline') + ' mode', () => {
      let out: Outcome;
      beforeAll(async () => {
        out = await buildProject(bundler, CORPUS, extract);
      }, 120000);
      afterAll(() => {
        if (out) removeProject(out.dir);
      });

      it('builds without errors or warnings', () => {
        expect(out.errors).toEqual([]);
        expect(out.warnings).toEqual([]);
        expect(out.consoleWarnings).toEqual([]);
      });

      it('exports the v1 symbol shape for every file', () => {
        for (const file of Object.keys(CORPUS)) {
          const icon = out.icons[file];
          const want = EXPECTED[file]!;
          expect(icon.id).toBe(want.id);
          expect(icon.viewBox).toBe(want.viewBox);
          expect(icon.url).toBe(extract ? '/assets/sprite.svg#' + want.id : '#' + want.id);
          expect(icon.content.startsWith('<symbol id="' + want.id + '" viewBox=')).toBe(true);
          expect(icon.content.endsWith('</symbol>')).toBe(true);
        }
      });

      it('gives different file names different ids, and the same id on every build', () => {
        const ids = Object.keys(CORPUS).map((f) => out.icons[f].id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('emits well-formed symbol markup for every file', () => {
        for (const file of Object.keys(CORPUS)) {
          const markup =
            '<svg ' +
            XMLNS +
            ' xmlns:xlink="http://www.w3.org/1999/xlink">' +
            out.icons[file].content +
            '</svg>';
          expect({ file, problems: xmlProblems(markup) }).toEqual({ file, problems: [] });
        }
      });

      it('keeps content that is not part of the root: no prolog, no comments around the root', () => {
        const content: string = out.icons['prolog.svg'].content;
        expect(content).toBe(
          '<symbol id="prolog" viewBox="0 0 7 7"><path d="M0 0h7v7z"/></symbol>',
        );
        expect(out.icons['wrapper.svg'].content).toBe(
          '<symbol id="wrapper" viewBox="0 0 9 9"><path d="M0 0"/></symbol>',
        );
      });

      it('handles CRLF line endings and a UTF-8 BOM', () => {
        expect(out.icons['crlf.svg'].content).toContain('fill="none"');
        expect(out.icons['crlf.svg'].content).toContain('<path d="M0 0"/>');
        expect(out.icons['bom.svg'].content).not.toContain('\uFEFF');
        expect(out.icons['bom.svg'].viewBox).toBe('0 0 11 11');
      });

      it('keeps nested svg, defs, style, symbol, script, duplicate ids, entities and CDATA verbatim', () => {
        expect(out.icons['nested.svg'].content).toContain('<svg viewBox="0 0 2 2">');
        const container: string = out.icons['container.svg'].content;
        for (const part of [
          '<defs>',
          '<style>.a > .b',
          '<symbol id="inner"',
          '<script>var x = 1 &lt; 2;</script>',
        ]) {
          expect(container).toContain(part);
        }
        expect(out.icons['dupids.svg'].content.match(/id="p"/g)).toHaveLength(2);
        expect(out.icons['entities.svg'].content).toContain(
          'Fish &amp; chips &lt;3 &#169; &#x263A;',
        );
        expect(out.icons['entities.svg'].content).toContain(
          '<![CDATA[ .a > .b { content: "&"; } ]]>',
        );
      });

      if (extract) {
        it('emits one well-formed sprite that contains every symbol exactly once, sorted by id', () => {
          expect(out.sprite).not.toBeNull();
          const sprite = out.sprite as string;
          expect(xmlProblems(sprite)).toEqual([]);
          const ids = symbolIds(path.join(out.dir, 'out', 'sprite.svg'));
          const expectedIds = Object.values(EXPECTED).map((e) => e.id);
          // Raw `<symbol>` elements nested inside an icon (container.svg) are listed too.
          expect(ids.filter((id) => id !== 'inner')).toEqual(
            expectedIds.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
          );
          for (const file of Object.keys(CORPUS)) {
            expect(sprite).toContain(out.icons[file].content);
          }
        });

        it('parses the sprite with a symbol for every <use> preview', () => {
          const sprite = out.sprite as string;
          const uses: string[] = [];
          const parser = new Parser(
            {
              onopentag(name, attrs) {
                if (name === 'use' && attrs['id']) uses.push(attrs['id']);
              },
            },
            { xmlMode: true },
          );
          parser.write(sprite);
          parser.end();
          expect(uses).toContain('with space-usage');
          expect(uses).toContain('ünï-日本-usage');
        });
      }
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Invalid input: a clear build error naming the file
// ---------------------------------------------------------------------------------------------

describe('invalid input fails with a clear error', () => {
  const BAD: Record<string, string> = {
    'empty.svg': '',
    'blank.svg': '  \r\n\t \n',
    'not-svg.svg': 'PNG\u0000\u0001binary-ish, definitely not markup',
    'html.svg': '<html><body><p>hello</p></body></html>',
  };

  for (const extract of [false, true]) {
    it(
      (extract ? 'extract' : 'inline') + ' mode: empty, blank, non-SVG and non-svg-root files',
      async () => {
        const out = await buildProject(RSPACK_1, BAD, extract);
        try {
          expect(out.errors).toHaveLength(Object.keys(BAD).length);
          for (const file of Object.keys(BAD)) {
            const err = out.errors.find((e) => e.includes(file));
            expect(err).toBeDefined();
            expect(err).toContain('rspack-plugin-svg-sprite: Invalid SVG content in ');
            expect(err).toContain(path.join(out.dir, file));
          }
        } finally {
          removeProject(out.dir);
        }
      },
      60000,
    );
  }

  it('the loader throws the same message when called directly', () => {
    for (const content of ['', '   ', 'hello', '<html/>']) {
      const ctx = { resourcePath: '/p/x.svg', getOptions: () => ({}) };
      expect(() => loader.call(ctx as any, content)).toThrow(
        'rspack-plugin-svg-sprite: Invalid SVG content in /p/x.svg',
      );
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Same name in two places, same file twice
// ---------------------------------------------------------------------------------------------

describe('the same icon imported from two paths', () => {
  const ICON = '<svg ' + XMLNS + ' viewBox="0 0 1 1"><path d="M0 0"/></svg>';

  it('one file reached by two import specifiers is one symbol and no warning', async () => {
    const out = await buildProject(
      RSPACK_1,
      { 'icons/x.svg': ICON },
      true,
      {},
      "import a from './icons/x.svg';\nimport b from './icons/../icons/x.svg';\nexport default [a, b];\n",
    );
    try {
      expect(out.errors).toEqual([]);
      expect(out.consoleWarnings).toEqual([]);
      expect(symbolIds(path.join(out.dir, 'out', 'sprite.svg'))).toEqual(['x']);
    } finally {
      removeProject(out.dir);
    }
  }, 60000);

  it('two files with the same name keep one symbol and warn that the second wins', async () => {
    const out = await buildProject(
      RSPACK_1,
      { 'a/x.svg': ICON, 'b/x.svg': ICON.replace('M0 0', 'M5 5') },
      true,
    );
    try {
      expect(out.errors).toEqual([]);
      expect(symbolIds(path.join(out.dir, 'out', 'sprite.svg'))).toEqual(['x']);
      expect(xmlProblems(out.sprite as string)).toEqual([]);
      const warning = out.consoleWarnings.find((w) => w.includes('Duplicate symbol ID "x"'));
      expect(warning).toContain('a' + path.sep + 'x.svg');
      expect(warning).toContain('b' + path.sep + 'x.svg');
    } finally {
      removeProject(out.dir);
    }
  }, 60000);

  it('a [folder]-[name] pattern keeps both', async () => {
    const out = await buildProject(RSPACK_1, { 'a/x.svg': ICON, 'b/x.svg': ICON }, true, {
      symbolId: '[folder]-[name]',
    });
    try {
      expect(out.consoleWarnings).toEqual([]);
      expect(symbolIds(path.join(out.dir, 'out', 'sprite.svg'))).toEqual(['a-x', 'b-x']);
      expect(xmlProblems(out.sprite as string)).toEqual([]);
    } finally {
      removeProject(out.dir);
    }
  }, 60000);
});

// ---------------------------------------------------------------------------------------------
// Loader called directly: ids, Windows paths, generated module validity
// ---------------------------------------------------------------------------------------------

const TINY = '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>';

function runLoader(resourcePath: string, content: string, options: Record<string, unknown> = {}) {
  const symbols: any[] = [];
  const warnings: Error[] = [];
  const ctx = {
    resourcePath,
    cacheable() {},
    getOptions: () => options,
    emitWarning: (w: Error) => warnings.push(w),
    _compiler: { options: { output: {} } },
    _compilation: { [NAMESPACE]: { addSymbol: (s: any) => symbols.push(s) } },
  };
  const code = loader.call(ctx as any, content);
  return { code, symbols, warnings };
}

/** Evaluates a CommonJS loader output with stub runtime modules and returns the exports. */
function evaluate(code: string): any {
  const stubSymbol = class {
    id: string;
    viewBox: string;
    content: string;
    url: string;
    constructor(d: any) {
      this.id = d.id;
      this.viewBox = d.viewBox;
      this.content = d.content;
      this.url = '#' + d.id;
    }
  };
  const mod: { exports: any } = { exports: {} };
  const fakeRequire = (id: string) => (id.endsWith('symbol') ? stubSymbol : { add() {} });
  new Function('require', 'module', code)(fakeRequire, mod);
  return mod.exports;
}

describe('symbol ids from file names', () => {
  const cases: Array<[string, string]> = [
    ['/icons/my icon.svg', 'my icon'],
    ['/icons/ünï-日本.svg', 'ünï-日本'],
    ['/icons/a.b.c.svg', 'a.b.c'],
    ['/icons/UPPER.svg', 'UPPER'],
    ['/icons/Mixed Case.svg', 'Mixed Case'],
    ['/icons/1-leading-digit.svg', '1-leading-digit'],
    ['/icons/.hidden.svg', '.hidden'],
    ['/icons/emoji-\u{1F600}.svg', 'emoji-\u{1F600}'],
  ];

  it.each(cases)('%s gives the stable id %s', (file, id) => {
    const first = runLoader(file, TINY, { extract: true });
    const second = runLoader(file, TINY, { extract: true });
    expect(first.symbols[0].id).toBe(id);
    expect(second.symbols[0].id).toBe(id);
    expect(first.symbols[0].content).toBe(second.symbols[0].content);
    const markup = '<svg ' + XMLNS + '>' + first.symbols[0].content + '</svg>';
    expect(xmlProblems(markup)).toEqual([]);
  });

  it('different names never share an id; the same name in two folders does (by design, warned)', () => {
    const names = cases.map(([file]) => runLoader(file, TINY, { extract: true }).symbols[0].id);
    expect(new Set(names).size).toBe(names.length);
    const a = runLoader('/a/x.svg', TINY, { extract: true }).symbols[0].id;
    const b = runLoader('/b/x.svg', TINY, { extract: true }).symbols[0].id;
    expect(a).toBe(b);
  });

  it('every id is unique across a corpus of look-alike names', () => {
    const files = ['a b', 'a_b', 'a-b', 'a.b', 'A B', 'a  b', 'a b ', 'é', 'e\u0301'];
    const ids = files.map(
      (n) => runLoader('/i/' + n + '.svg', TINY, { extract: true }).symbols[0].id,
    );
    expect(new Set(ids).size).toBe(files.length);
  });
});

describe('Windows-style resource paths', () => {
  const paths = [
    'C:\\icons\\win.svg',
    'C:/icons/fwd.svg',
    '\\\\server\\share\\with space.svg',
    'D:\\a\\b\\..\\c.svg',
  ];

  it.each(paths)('%s produces a valid, evaluable module in both modes', (resourcePath) => {
    for (const extract of [false, true]) {
      const { code, symbols } = runLoader(resourcePath, TINY, { extract, esModule: false });
      const exported = evaluate(code);
      expect(exported.viewBox).toBe('0 0 1 1');
      if (extract) expect(symbols[0].id).toBe(exported.id);
      // The id is the file name when the host path separator applies. On POSIX a backslash is
      // an ordinary file name character, so the whole string stays in the id.
      expect(exported.id.endsWith(path.basename(resourcePath, '.svg'))).toBe(true);
      expect(exported.content).toBe(
        '<symbol id="' + exported.id + '" viewBox="0 0 1 1"><path d="M0 0"/></symbol>',
      );
    }
  });

  it('the generated runtime require paths survive backslashes', () => {
    const { code } = runLoader('C:\\x\\y.svg', TINY, { esModule: false });
    expect(() => new Function('require', 'module', code)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------------------------
// Large inputs, with a time bound
// ---------------------------------------------------------------------------------------------

describe('large inputs', () => {
  const HUGE_PATH = 'M0 0L1 1'.repeat(750_000); // 6 MB of path data
  const MANY = '<circle cx="1" cy="1" r="1"/>'.repeat(60_000); // 60 000 elements, 1.8 MB
  const DEEP = '<svg>'.repeat(3000) + '</svg>'.repeat(3000);

  it('the loader handles several MB of path data, thousands of elements and deep nesting quickly', () => {
    const inputs = [
      '<svg viewBox="0 0 1 1"><path d="' + HUGE_PATH + '"/></svg>',
      '<svg viewBox="0 0 1 1">' + MANY + '</svg>',
      '<svg viewBox="0 0 1 1">' + DEEP + '</svg>',
      // many attributes on the root, and a malformed root that takes the v1 fallback
      '<svg ' + 'a="1" '.repeat(100_000) + 'viewBox="0 0 1 1">x</svg>',
      '<svg ' + 'a="1" '.repeat(100_000) + 'broken>x</svg>',
    ];
    const started = Date.now();
    for (const input of inputs) {
      const { symbols } = runLoader('/big/x.svg', input, { extract: true });
      expect(symbols[0].content.endsWith('</symbol>')).toBe(true);
    }
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('a real extract build with a 6 MB icon and a 60 000 element icon finishes and stays well formed', async () => {
    const out = await buildProject(
      RSPACK_1,
      {
        'huge.svg': '<svg ' + XMLNS + ' viewBox="0 0 1 1"><path d="' + HUGE_PATH + '"/></svg>',
        'many.svg': '<svg ' + XMLNS + ' viewBox="0 0 1 1">' + MANY + '</svg>',
      },
      true,
    );
    try {
      expect(out.errors).toEqual([]);
      expect(out.ms).toBeLessThan(60000);
      expect(symbolIds(path.join(out.dir, 'out', 'sprite.svg'))).toEqual(['huge', 'many']);
      expect((out.sprite as string).length).toBeGreaterThan(7_000_000);
      expect(xmlProblems(out.sprite as string)).toEqual([]);
    } finally {
      removeProject(out.dir);
    }
  }, 120000);
});

// ---------------------------------------------------------------------------------------------
// Former defects. Each one is the minimal reproduction of a bug that is now fixed.
// ---------------------------------------------------------------------------------------------

function spriteFor(resourcePath: string, content: string): string {
  const plugin = new SvgSpritePlugin() as any;
  runLoaderInto(plugin, resourcePath, content);
  return plugin.generateSprite(plugin.symbols);
}

function runLoaderInto(plugin: any, resourcePath: string, content: string): void {
  const ctx = {
    resourcePath,
    cacheable() {},
    getOptions: () => ({ extract: true }),
    _compiler: { options: { output: {} } },
    _compilation: { [NAMESPACE]: plugin },
  };
  loader.call(ctx as any, content);
}

describe('former defects (fixed)', () => {
  // DEFECT 1 (medium). The symbol id is the file name, written into `id="..."` and into the
  // sprite's `<use id href>` without escaping. A file such as `Q&A.svg` produces `id="Q&A"`,
  // which is not well-formed XML, so a browser refuses to parse the whole external sprite and
  // every icon in it disappears.
  it('a file name with an ampersand keeps the sprite well formed', () => {
    expect(xmlProblems(spriteFor('/icons/Q&A.svg', TINY))).toEqual([]);
  });

  // DEFECT 2 (medium). Same cause with a double quote or `<` in the file name: `a"b.svg` gives
  // `<symbol id="a"b" ...>`, an attribute injection that corrupts the symbol.
  it('a file name with a quote or angle bracket keeps the sprite well formed', () => {
    expect(xmlProblems(spriteFor('/icons/a"b.svg', TINY))).toEqual([]);
    expect(xmlProblems(spriteFor('/icons/a<b.svg', TINY))).toEqual([]);
  });

  // DEFECT 3 (low). Quadratic regex in the v1 fallback. An SVG with a malformed root and many
  // `<svg` occurrences makes `/<svg([^>]*)>/` rescan to the end of the file at every position:
  // 20 000 repetitions (100 KB) take about 8 seconds, 100 000 would take minutes.
  it('a file that is 20 000 repetitions of "<svg " does not stall the loader', () => {
    const started = Date.now();
    runLoader('/x/evil.svg', '<svg '.repeat(20_000), { extract: true });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  // DEFECT 4 (low). A DOCTYPE that declares entities used inside the icon is dropped with the
  // rest of the prolog, so the sprite references an entity it no longer declares and is not
  // well-formed XML. Old Illustrator exports do this.
  it('entities declared in a DOCTYPE are reported with a build warning naming file and entity', () => {
    const svg =
      '<!DOCTYPE svg [<!ENTITY fill "red">]><svg viewBox="0 0 5 5"><path fill="&fill;" d="M0 0"/></svg>';
    const out = runLoader('/icons/ent.svg', svg);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]!.message).toContain('/icons/ent.svg');
    expect(out.warnings[0]!.message).toContain('&fill;');
    expect(out.warnings[0]!.message).toContain('DOCTYPE');
  });
});
