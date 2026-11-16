import { describe, it, expect } from '@rstest/core';
import fs from 'fs';
import path from 'path';
import { Parser, parseDocument } from 'htmlparser2';
import { DomUtils } from 'htmlparser2';
import loader, { NAMESPACE } from '../loader';
import SvgSpritePlugin from '../plugin';
import SpriteSymbol from '../runtime/symbol';
import {
  ALL_BUNDLERS,
  LOADER,
  SvgSpritePlugin as BuiltPlugin,
  makeProject,
  nodeRequire,
  removeProject,
} from './integration/helpers';

/**
 * File names and options that contain markup characters. The id is the file name, so it must be
 * escaped wherever it is written into markup, while `icon.id` stays the raw name.
 */

const TINY = '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>';

// Well-formedness: htmlparser2 in XML mode plus the entity check it is too lenient to make.
function xmlProblems(xml: string): string[] {
  const problems: string[] = [];
  const stack: string[] = [];
  const parser = new Parser(
    {
      onopentag(name) {
        stack.push(name);
      },
      onclosetag(name, implied) {
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
    { xmlMode: true, decodeEntities: false },
  );
  parser.write(xml);
  parser.end();
  if (stack.length > 0) problems.push('unclosed: ' + stack.join(','));
  const entity = xml.match(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)[^\s<]{0,12}/g);
  if (entity) problems.push('bare or undeclared entity: ' + entity.join(' '));
  return problems;
}

/** Decodes the `href="#fragment"` of a `<use>` the way a URL parser does. */
function fragmentOf(href: string): string {
  return decodeURIComponent(href.slice(href.indexOf('#') + 1));
}

const NAMES: Record<string, string> = {
  ampersand: 'Q&A',
  'less-than': 'a<b',
  'greater-than': 'a>b',
  'double quote': 'a"b',
  apostrophe: "it's",
  'all five': `a&b<c>d"e'f`,
  'entity lookalike': 'a&amp;b',
  percent: '50%25off',
};

function runExtract(name: string, options: Record<string, unknown> = {}) {
  const plugin = new SvgSpritePlugin() as any;
  const ctx = {
    resourcePath: '/icons/' + name + '.svg',
    cacheable() {},
    getOptions: () => ({ extract: true, ...options }),
    _compiler: { options: { output: {} } },
    _compilation: { [NAMESPACE]: plugin },
  };
  const code = loader.call(ctx as any, TINY);
  return { sprite: plugin.generateSprite(plugin.symbols) as string, code, plugin };
}

describe('escaping the id (unit)', () => {
  for (const [label, name] of Object.entries(NAMES)) {
    it('extract sprite stays well formed and resolves for ' + label, () => {
      const { sprite } = runExtract(name);
      expect(xmlProblems(sprite)).toEqual([]);
      const doc = parseDocument(sprite, { xmlMode: true });
      const symbols = DomUtils.getElementsByTagName('symbol', doc);
      const uses = DomUtils.getElementsByTagName('use', doc);
      expect(symbols.map((s) => s.attribs.id)).toEqual([name]);
      expect(uses).toHaveLength(1);
      expect(uses[0]!.attribs.id).toBe(name + '-usage');
      expect(fragmentOf(uses[0]!.attribs.href!)).toBe(name);
    });

    it('inline module keeps raw id, escapes content, for ' + label, () => {
      const ctx = {
        resourcePath: '/icons/' + name + '.svg',
        cacheable() {},
        getOptions: () => ({}),
      };
      const code = loader.call(ctx as any, TINY);
      const data = JSON.parse(/new SpriteSymbol\((\{.*\})\);/.exec(code)![1]!);
      expect(data.id).toBe(name);
      const doc = parseDocument(data.content, { xmlMode: true });
      expect(xmlProblems(data.content)).toEqual([]);
      expect(DomUtils.getElementsByTagName('symbol', doc)[0]!.attribs.id).toBe(name);
    });
  }

  it('leaves ids made of ordinary characters byte-for-byte unchanged', () => {
    const { sprite } = runExtract("it's-a>b_1.2");
    expect(sprite).toContain('<symbol id="it\'s-a>b_1.2" viewBox="0 0 1 1">');
    expect(sprite).toContain('<use id="it\'s-a>b_1.2-usage" href="#it\'s-a>b_1.2"');
  });

  it('escapes the id exactly as documented', () => {
    const { sprite } = runExtract('Q&A<"');
    expect(sprite).toContain('<symbol id="Q&amp;A&lt;&quot;" ');
  });

  it('exports the raw id and url, and the escaped markup as content', () => {
    const { code } = runExtract('Q&A', { publicPath: '/s/' });
    expect(code).toContain('"id":"Q&A"');
    expect(code).toContain('symbol.url = "/s/sprite.svg#Q&A"');
    expect(code).toContain('<symbol id=\\"Q&amp;A\\"');
  });

  it('only percent-encodes a % that would read as an escape sequence', () => {
    expect(runExtract('50%25off').code).toContain('sprite.svg#50%2525off');
    expect(runExtract('100%').code).toContain('sprite.svg#100%"');
    const symbol = new SpriteSymbol({ id: '50%25off', viewBox: '0 0 1 1', content: '' });
    expect(symbol.url).toBe('#50%2525off');
    expect(new SpriteSymbol({ id: 'Q&A', viewBox: '', content: '' }).url).toBe('#Q&A');
  });
});

describe('escaping other values written into markup', () => {
  function symbolMarkup(svg: string): string {
    const plugin = new SvgSpritePlugin() as any;
    const ctx = {
      resourcePath: '/icons/x.svg',
      cacheable() {},
      getOptions: () => ({ extract: true }),
      _compiler: { options: { output: {} } },
      _compilation: { [NAMESPACE]: plugin },
    };
    loader.call(ctx as any, svg);
    return plugin.symbols[0].content;
  }

  it('escapes the quote in copied root attributes and viewBox, and copies the rest as written', () => {
    const content = symbolMarkup(
      `<svg viewBox='0 0 1 1' data-a='x"y' data-b="a&amp;b&#10;" fill="none"><path/></svg>`,
    );
    expect(content).toContain('data-a="x&quot;y"');
    expect(content).toContain('data-b="a&amp;b&#10;"');
    expect(xmlProblems(content)).toEqual([]);
    expect(symbolMarkup(`<svg viewBox='0 0 "1" 1'><path/></svg>`)).toContain(
      'viewBox="0 0 &quot;1&quot; 1"',
    );
  });

  it('drops a root attribute whose name cannot be written as markup', () => {
    const content = symbolMarkup('<svg viewBox="0 0 1 1" a&b="1" ok="2"><path/></svg>');
    expect(content).not.toContain('a&b');
    expect(content).toContain('ok="2"');
  });

  it('escapes spriteAttrs values and skips invalid names with a warning', () => {
    const plugin = new SvgSpritePlugin({
      spriteAttrs: { title: 'a&b "c" <d>', style: 'x:y', 'bad name': '1', 'a&amp;b': 'x' },
    } as any);
    const original = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(' '));
    let sprite: string;
    try {
      sprite = plugin.generateSprite([]);
    } finally {
      console.warn = original;
    }
    expect(sprite).toContain('title="a&amp;b &quot;c&quot; &lt;d>"');
    expect(sprite).toContain('style="x:y"');
    expect(sprite).not.toContain('bad name');
    expect(warnings.join('\n')).toContain('"bad name"');
    expect(xmlProblems(sprite)).toEqual([]);
  });

  it('keeps a well-formed spriteAttrs value that already uses a reference', () => {
    const plugin = new SvgSpritePlugin({ spriteAttrs: { title: 'a&amp;b' } });
    expect(plugin.generateSprite([])).toContain('title="a&amp;b"');
  });
});

describe('DOCTYPE entity warning (unit)', () => {
  function warningsFor(svg: string): string[] {
    const warnings: Error[] = [];
    const ctx = {
      resourcePath: '/icons/e.svg',
      cacheable() {},
      getOptions: () => ({}),
      emitWarning: (w: Error) => warnings.push(w),
    };
    loader.call(ctx as any, svg);
    return warnings.map((w) => w.message);
  }

  it('warns once for several used entities, naming each', () => {
    const [message] = warningsFor(
      '<!DOCTYPE svg [<!ENTITY a "1"><!ENTITY b "2"><!ENTITY c "3">]><svg><path d="&a;&b;"/></svg>',
    );
    expect(message).toContain('/icons/e.svg');
    expect(message).toContain('&a;, &b;');
    expect(message).not.toContain('&c;');
    expect(message).toContain('them');
  });

  it('does not warn when the entity is declared but not used', () => {
    expect(warningsFor('<!DOCTYPE svg [<!ENTITY a "1">]><svg><path/></svg>')).toEqual([]);
  });

  it('does not warn for predefined entities, parameter entities or a DOCTYPE without a subset', () => {
    expect(
      warningsFor('<!DOCTYPE svg [<!ENTITY amp "&#38;">]><svg><path d="&amp;"/></svg>'),
    ).toEqual([]);
    expect(warningsFor('<!DOCTYPE svg [<!ENTITY % p "x">]><svg><path d="&p;"/></svg>')).toEqual([]);
    expect(warningsFor('<!DOCTYPE svg PUBLIC "a" "b"><svg><path d="&a;"/></svg>')).toEqual([]);
    expect(warningsFor('<svg><path d="&a;"/></svg>')).toEqual([]);
  });

  it('ignores references to entities that were not declared, and a DOCTYPE after the root', () => {
    expect(warningsFor('<!DOCTYPE svg [<!ENTITY a "1">]><svg><path d="&b;"/></svg>')).toEqual([]);
    expect(warningsFor('<svg/><!DOCTYPE svg [<!ENTITY a "1">]>&a;')).toEqual([]);
  });

  it('does not warn when a "[" only appears after the root element', () => {
    expect(warningsFor('<!DOCTYPE svg><svg><path d="[&a;"/></svg>')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Real builds
// ---------------------------------------------------------------------------------------------

function buildNames(bundler: (typeof ALL_BUNDLERS)[number], extract: boolean, names: string[]) {
  const files: Record<string, string> = {};
  names.forEach((n) => (files[n + '.svg'] = TINY));
  const entry =
    names
      .map((n, i) => 'import i' + i + ' from ' + JSON.stringify('./' + n + '.svg') + ';')
      .join('\n') +
    '\nexport default [' +
    names.map((_, i) => 'i' + i).join(', ') +
    '];\n';
  const dir = makeProject({ ...files, 'index.js': entry });
  const original = console.warn;
  console.warn = () => {};
  return new Promise<{ dir: string; errors: string[]; icons: any[]; sprite: string | null }>(
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
              options: { extract },
            },
          ],
        },
        plugins: extract ? [new BuiltPlugin()] : [],
      });
      compiler.run((err: Error | null, stats: any) => {
        compiler.close(() => {
          console.warn = original;
          if (err) return reject(err);
          const json = stats.toJson({ all: false, errors: true });
          const sprite = path.join(dir, 'out', 'sprite.svg');
          const mod = nodeRequire(path.join(dir, 'out', 'bundle.js'));
          resolve({
            dir,
            errors: (json.errors || []).map((e: any) => String(e.message || e)),
            icons: mod.default || mod,
            sprite: fs.existsSync(sprite) ? fs.readFileSync(sprite, 'utf8') : null,
          });
        });
      });
    },
  );
}

const REAL_NAMES = ['Q&A', 'a<b', 'a>b', 'a"b', "it's", 'plain'];

describe('file names with markup characters in real builds', () => {
  for (const bundler of ALL_BUNDLERS) {
    it(
      bundler.name + ' extract: a well-formed sprite, every icon resolvable',
      async () => {
        const out = await buildNames(bundler, true, REAL_NAMES);
        try {
          expect(out.errors).toEqual([]);
          expect(xmlProblems(out.sprite!)).toEqual([]);
          const doc = parseDocument(out.sprite!, { xmlMode: true });
          const symbolIds = DomUtils.getElementsByTagName('symbol', doc).map((s) => s.attribs.id);
          const hrefs = DomUtils.getElementsByTagName('use', doc).map((u) =>
            fragmentOf(u.attribs.href!),
          );
          expect(symbolIds.slice().sort()).toEqual(REAL_NAMES.slice().sort());
          expect(hrefs.slice().sort()).toEqual(REAL_NAMES.slice().sort());
          for (const icon of out.icons) {
            expect(REAL_NAMES).toContain(icon.id);
            expect(symbolIds).toContain(icon.id);
            expect(fragmentOf(icon.url)).toBe(icon.id);
            expect(icon.url.startsWith('/assets/sprite.svg#')).toBe(true);
          }
        } finally {
          removeProject(out.dir);
        }
      },
      60000,
    );

    it(
      bundler.name + ' inline: raw id, escaped well-formed content',
      async () => {
        const out = await buildNames(bundler, false, REAL_NAMES);
        try {
          expect(out.errors).toEqual([]);
          for (const icon of out.icons) {
            expect(REAL_NAMES).toContain(icon.id);
            expect(icon.url).toBe('#' + icon.id);
            expect(xmlProblems(icon.content)).toEqual([]);
            const doc = parseDocument(icon.content, { xmlMode: true });
            expect(DomUtils.getElementsByTagName('symbol', doc)[0]!.attribs.id).toBe(icon.id);
          }
        } finally {
          removeProject(out.dir);
        }
      },
      60000,
    );
  }
});
