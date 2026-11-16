import { describe, it, expect, beforeAll } from '@rstest/core';
import fs from 'fs';
import path from 'path';
import { Window } from 'happy-dom';
import { parseDocument } from 'htmlparser2';
import {
  ALL_BUNDLERS,
  LOADER,
  SvgSpritePlugin,
  makeProject,
  nodeRequire,
  removeProject,
} from './helpers';

/**
 * Drop-in parity with svg-sprite-loader 6.x.
 *
 * The same SVG files are built with the same loader options through webpack 5 +
 * svg-sprite-loader and webpack 5 + this package. Each bundle is executed in a DOM
 * (happy-dom), so the inline runtime really mounts its symbols. For every icon the test
 * compares `id`, `viewBox`, `url`, `String(icon)` and `content`; it compares the symbols that
 * reached the document (inline mode) and the emitted sprite file (extract mode: file name,
 * symbol ids, viewBoxes, symbol markup, the preview <use> elements and the root attributes).
 *
 * Normalization of symbol markup, applied to both sides and nothing else:
 *  - the markup is parsed as XML and compared as a tree: attribute order, self-closing style
 *    (`<a/>` against `<a />`) and whitespace-only text nodes do not count, other text is
 *    whitespace-collapsed;
 *  - the redundant `xmlns="http://www.w3.org/2000/svg"` on the <symbol> root is dropped: the
 *    sprite root or the HTML parser supplies that namespace, so rendering is the same;
 * The DOM check covers which symbols are mounted and their id and viewBox, not their inner
 * markup: happy-dom's HTML fragment parser lower-cases SVG names (`viewBox`, `linearGradient`)
 * and ignores `/>` inside <svg>, both of which browsers handle correctly, so the inner markup
 * of a mounted symbol is compared through `content` (the exact string the runtime mounts).
 * Element and attribute names, attribute values, ids, comments and element order must be equal.
 * Every remaining difference has to be listed in KNOWN_DIFFERENCES with a reason; an entry that
 * no longer matches a real difference fails the test.
 *
 * Not covered: `runtimeCompat` (svg-sprite-loader only, this package has no such option) and
 * svg-sprite-loader's `[chunkname]`, `symbolRegExp`, `runtimeGenerator`, `spriteModule` and
 * `symbolModule` options, none of which this package supports.
 */

const FIXTURES = path.join(process.cwd(), 'src/__tests__/fixtures');
const PARITY = path.join(FIXTURES, 'parity');
const SVG_NS = 'http://www.w3.org/2000/svg';

const theirsLoader = nodeRequire.resolve('svg-sprite-loader');
const TheirsPlugin = nodeRequire('svg-sprite-loader/plugin');
const webpack = nodeRequire('webpack');

type Lib = 'theirs' | 'mine';

interface Variant {
  name: string;
  options: Record<string, unknown>;
  extract: boolean;
  /** `output.publicPath` of the bundle. */
  outputPublicPath?: string;
}

const VARIANTS: Variant[] = [
  { name: 'inline defaults', options: {}, extract: false },
  { name: 'inline symbolId pattern', options: { symbolId: 'icon-[name]' }, extract: false },
  {
    name: 'inline symbolId folder pattern',
    options: { symbolId: '[folder]-[name]' },
    extract: false,
  },
  {
    name: 'inline symbolId function',
    options: { symbolId: (file: string) => 'fn-' + path.basename(file, '.svg').toUpperCase() },
    extract: false,
  },
  { name: 'inline esModule false', options: { esModule: false }, extract: false },
  { name: 'extract defaults', options: {}, extract: true },
  {
    name: 'extract spriteFilename and publicPath',
    options: { symbolId: 'icon-[name]', spriteFilename: 'icons/sprite.svg', publicPath: '/cdn/' },
    extract: true,
  },
  {
    // esModule false: with webpack 5.105 svg-sprite-loader rewrites the module source after it
    // was parsed when the file name contains [hash], which corrupts an `export default` module
    // ("return this.url;);"). The CommonJS form survives, so it is the one that can be compared.
    name: 'extract spriteFilename with [hash]',
    options: { spriteFilename: 'sprite-[hash].svg', esModule: false },
    extract: true,
  },
  {
    name: 'extract output.publicPath esModule false',
    options: { esModule: false, symbolId: 'sym-[name]' },
    extract: true,
    outputPublicPath: '/assets/',
  },
];

interface Icon {
  /** File name without extension, also the key in the bundle. */
  key: string;
  file: string;
}

function listIcons(): Icon[] {
  const out: Icon[] = [];
  for (const dir of [FIXTURES, PARITY]) {
    for (const file of fs.readdirSync(dir).sort()) {
      if (file.endsWith('.svg')) {
        out.push({ key: path.basename(file, '.svg'), file: path.join(dir, file) });
      }
    }
  }
  return out;
}

interface SymbolView {
  id: unknown;
  viewBox: unknown;
  url: unknown;
  str: string;
  content: unknown;
}

interface DomSymbol {
  id: string;
  viewBox: string | null;
  markup: string;
}

interface Built {
  icons: Record<string, SymbolView>;
  /** Symbols found in the document after the bundle ran (inline mode). */
  dom: DomSymbol[];
  /** Emitted files other than the bundle: relative path to text. */
  files: Record<string, string>;
}

function runBundle(code: string): { icons: Record<string, SymbolView>; dom: DomSymbol[] } {
  const win = new Window({ url: 'http://localhost/' });
  try {
    win.eval(code);
    const exported = (win as any).__icons as Record<string, any>;
    const icons: Record<string, SymbolView> = {};
    for (const key of Object.keys(exported)) {
      const mod = exported[key];
      const sym = mod && mod.__esModule ? mod.default : mod;
      icons[key] = {
        id: sym.id,
        viewBox: sym.viewBox,
        url: sym.url,
        str: String(sym),
        content: sym.content,
      };
    }
    const dom: DomSymbol[] = [];
    for (const el of Array.from(win.document.querySelectorAll('symbol'))) {
      dom.push({
        id: el.getAttribute('id') || '',
        viewBox: el.getAttribute('viewBox'),
        markup: el.outerHTML,
      });
    }
    return { icons, dom };
  } finally {
    win.close();
  }
}

function collectFiles(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const rel of fs.readdirSync(dir, { recursive: true }) as string[]) {
    const abs = path.join(dir, rel);
    if (!fs.statSync(abs).isFile() || rel === 'bundle.js') continue;
    files[rel.split(path.sep).join('/')] = fs.readFileSync(abs, 'utf8');
  }
  return files;
}

async function buildOne(
  lib: Lib,
  variant: Variant,
  icons: Icon[],
  bundler: any = webpack,
): Promise<Built> {
  const entries = icons.map(
    (i) => '  ' + JSON.stringify(i.key) + ': require("./icons/' + i.key + '.svg")',
  );
  const project: Record<string, string> = {
    'index.js': 'module.exports = {\n' + entries.join(',\n') + '\n};\n',
  };
  for (const icon of icons) {
    project['icons/' + icon.key + '.svg'] = fs.readFileSync(icon.file, 'utf8');
  }
  const dir = makeProject(project);
  try {
    const config = {
      mode: 'development',
      devtool: false,
      target: 'web',
      context: dir,
      entry: './index.js',
      output: {
        path: path.join(dir, 'out'),
        filename: 'bundle.js',
        library: { type: 'assign', name: '__icons' },
        publicPath: variant.outputPublicPath ?? '',
      },
      module: {
        rules: [
          {
            test: /\.svg$/,
            type: 'javascript/auto',
            loader: lib === 'mine' ? LOADER : theirsLoader,
            options: { ...variant.options, extract: variant.extract },
          },
        ],
      },
      plugins: variant.extract ? [lib === 'mine' ? new SvgSpritePlugin() : new TheirsPlugin()] : [],
    };
    await new Promise<void>((resolve, reject) => {
      const compiler = bundler(config);
      compiler.run((err: Error | null, stats: any) => {
        compiler.close(() => {
          if (err) return reject(err);
          if (stats.hasErrors()) {
            return reject(new Error(stats.toString({ all: false, errors: true })));
          }
          resolve();
        });
      });
    });
    const code = fs.readFileSync(path.join(dir, 'out', 'bundle.js'), 'utf8');
    const ran = runBundle(code);
    return { icons: ran.icons, dom: ran.dom, files: collectFiles(path.join(dir, 'out')) };
  } finally {
    removeProject(dir);
  }
}

/* ---------------------------------------------------------------- normalization */

function normalizeNode(node: any, isRoot: boolean): string {
  if (node.type === 'text') {
    const text = String(node.data).replace(/\s+/g, ' ').trim();
    return text === '' ? '' : JSON.stringify(text);
  }
  if (node.type === 'comment') {
    return '<!--' + String(node.data).replace(/\s+/g, ' ').trim() + '-->';
  }
  if (node.type !== 'tag') return '';
  const attrs = Object.entries(node.attribs as Record<string, string>)
    .filter(([name, value]) => !(isRoot && name === 'xmlns' && value === SVG_NS))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => name + '=' + JSON.stringify(value))
    .join(' ');
  const children = (node.children as any[])
    .map((child) => normalizeNode(child, false))
    .filter((c) => c !== '')
    .join('');
  return '<' + node.name + (attrs ? ' ' + attrs : '') + '>' + children + '</' + node.name + '>';
}

function normalizeMarkup(markup: unknown): string {
  if (typeof markup !== 'string') return '<<' + String(markup) + '>>';
  const doc = parseDocument(markup, { xmlMode: true });
  return doc.children.map((child) => normalizeNode(child, true)).join('');
}

/* ---------------------------------------------------------------- sprite reading */

function walk(node: any, visit: (n: any) => void): void {
  visit(node);
  for (const child of node.children || []) walk(child, visit);
}

function serialize(node: any): string {
  if (node.type === 'text') return node.data;
  if (node.type === 'comment') return '<!--' + node.data + '-->';
  if (node.type !== 'tag') return '';
  const attrs = Object.entries(node.attribs as Record<string, string>)
    .map(([k, v]) => ' ' + k + '="' + v + '"')
    .join('');
  return (
    '<' + node.name + attrs + '>' + node.children.map(serialize).join('') + '</' + node.name + '>'
  );
}

interface SpriteView {
  symbols: Map<string, { viewBox: string | null; markup: string }>;
  root: Record<string, string>;
  /** Preview <use> elements, with every attribute. */
  usages: string[];
  style: string;
}

function readSprite(sprite: string): SpriteView {
  const doc = parseDocument(sprite, { xmlMode: true });
  const symbols = new Map<string, { viewBox: string | null; markup: string }>();
  const usages: string[] = [];
  let style = '';
  walk(doc, (n) => {
    if (n.type !== 'tag') return;
    if (n.name === 'symbol') {
      symbols.set(n.attribs.id, { viewBox: n.attribs.viewBox ?? null, markup: serialize(n) });
    } else if (n.name === 'use' && String(n.attribs.id || '').endsWith('-usage')) {
      usages.push(
        Object.entries(n.attribs as Record<string, string>)
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([k, v]) => k + '=' + v)
          .join(' '),
      );
    } else if (n.name === 'style') {
      style = n.children.map(serialize).join('').replace(/\s+/g, ' ').trim();
    }
  });
  const rootTag = doc.children.find((c: any) => c.type === 'tag') as any;
  return {
    symbols,
    root: Object.fromEntries(Object.entries(rootTag.attribs as Record<string, string>).sort()),
    usages: usages.sort(),
    style,
  };
}

/* ---------------------------------------------------------------- comparison */

interface Difference {
  /** `<variant>/<icon>`, `<variant>/dom...`, `<variant>/sprite/<id>` or `<variant>/sprite`. */
  where: string;
  field: string;
  /** Id of the symbol this is about, when there is one. */
  symbolId?: string | undefined;
  theirs: unknown;
  mine: unknown;
}

function compareBuilt(variant: Variant, icons: Icon[], theirs: Built, mine: Built): Difference[] {
  const diffs: Difference[] = [];
  const push = (where: string, field: string, t: unknown, m: unknown, symbolId?: string) => {
    if (JSON.stringify(t) !== JSON.stringify(m)) {
      diffs.push({ where: variant.name + '/' + where, field, symbolId, theirs: t, mine: m });
    }
  };

  for (const { key } of icons) {
    const t = theirs.icons[key]!;
    const m = mine.icons[key]!;
    const symbolId = String(m.id);
    push(key, 'id', t.id, m.id, symbolId);
    push(key, 'viewBox', t.viewBox, m.viewBox, symbolId);
    push(key, 'url', t.url, m.url, symbolId);
    push(key, 'toString', t.str, m.str, symbolId);
    push(key, 'content', normalizeMarkup(t.content), normalizeMarkup(m.content), symbolId);
  }

  // Symbols that reached the document (inline mode).
  const tDom = new Map(theirs.dom.map((d) => [d.id, d]));
  const mDom = new Map(mine.dom.map((d) => [d.id, d]));
  push('dom', 'symbol ids', Array.from(tDom.keys()).sort(), Array.from(mDom.keys()).sort());
  for (const [id, t] of tDom) {
    const m = mDom.get(id);
    if (!m) continue;
    push('dom/' + id, 'viewBox', t.viewBox, m.viewBox, id);
  }

  // The emitted sprite (extract mode).
  const tFiles = Object.keys(theirs.files).sort();
  const mFiles = Object.keys(mine.files).sort();
  push('sprite', 'files', tFiles, mFiles);
  if (tFiles.length === 1 && mFiles.length === 1) {
    const t = readSprite(theirs.files[tFiles[0]!]!);
    const m = readSprite(mine.files[mFiles[0]!]!);
    push(
      'sprite',
      'symbol ids',
      Array.from(t.symbols.keys()).sort(),
      Array.from(m.symbols.keys()).sort(),
    );
    for (const [id, ts] of t.symbols) {
      const ms = m.symbols.get(id);
      if (!ms) continue;
      push('sprite/' + id, 'viewBox', ts.viewBox, ms.viewBox, id);
      push('sprite/' + id, 'markup', normalizeMarkup(ts.markup), normalizeMarkup(ms.markup), id);
    }
    push('sprite', 'root attributes', t.root, m.root);
    push('sprite', 'preview style', t.style, m.style);
    push('sprite', 'preview <use> elements', t.usages, m.usages);
  } else if (variant.extract) {
    diffs.push({
      where: variant.name + '/sprite',
      field: 'file count',
      theirs: tFiles,
      mine: mFiles,
    });
  }
  return diffs;
}

/* ---------------------------------------------------------------- allowlist */

interface Known {
  /** Tested against `<variant>/<icon>`, `<variant>/dom/<id>` or `<variant>/sprite...`. */
  where: RegExp;
  field: string;
  /** Why this package differs. "UNDER REVIEW" marks a difference that no doc explains. */
  reason: string;
  /** Proves the difference is of the described kind, so the entry cannot hide anything else. */
  holds: (d: Difference) => boolean;
}

const s = (v: unknown): string => (typeof v === 'string' ? v : (JSON.stringify(v) ?? 'undefined'));
const SPRITE_HASHED = /^sprite-[0-9a-f]{32}\.svg$/;

function splitUrl(url: string): [string, string] {
  const at = url.indexOf('#');
  return at === -1 ? [url, ''] : [url.slice(0, at), url.slice(at + 1)];
}

/** svg-sprite-loader renames ids inside an icon to `<symbolId>_<id>`; undo that. */
function unprefix(markup: string, symbolId: string | undefined): string {
  return markup.split((symbolId ?? '') + '_').join('');
}

const usageFragment = (d: Difference): boolean => {
  const [tBase, tFrag] = splitUrl(s(d.theirs));
  const [mBase, mFrag] = splitUrl(s(d.mine));
  return tBase === mBase && tFrag === mFrag + '-usage';
};
const hashedUsageFragment = (d: Difference): boolean => {
  const [tBase, tFrag] = splitUrl(s(d.theirs));
  const [mBase, mFrag] = splitUrl(s(d.mine));
  return SPRITE_HASHED.test(tBase) && mBase === 'sprite-[hash].svg' && tFrag === mFrag + '-usage';
};

const XLINK_DECL = ' xmlns:xlink="http://www.w3.org/1999/xlink"';
const PREFIX_REASON =
  'svg-sprite-loader renames ids inside each icon to "<symbolId>_<id>" and rewrites the ' +
  'url(#..) and href references to them; this package leaves ids untouched, so two icons that ' +
  'both define id="a" collide. README "Two icons show the same gradient, clip path, or class ' +
  'styling" documents the SVGO prefixIds recipe for this. svg-sprite-loader does not rewrite ' +
  'aria-labelledby, so its titled.svg ends up with a dangling reference. It also keeps the ' +
  'redundant xmlns:xlink declaration on the symbol (xlink.svg).';
const prefixOnly = (d: Difference): boolean =>
  s(d.theirs).includes((d.symbolId ?? '') + '_') &&
  unprefix(s(d.theirs), d.symbolId).split(XLINK_DECL).join('') === s(d.mine);
const GRADIENT = /<linearGradient[^>]*>.*?<\/linearGradient>/;
const prefixAndHoist = (d: Difference): boolean =>
  s(d.theirs).includes('<defs></defs>') &&
  unprefix(s(d.theirs), d.symbolId) === s(d.mine).replace(GRADIENT, '');
const droppedClass = (d: Difference): boolean =>
  s(d.theirs).split(' class="icon big"').join('') === s(d.mine) && !s(d.mine).includes('class=');

const CLASS_REASON =
  'UNDER REVIEW. svg-sprite-loader copies the root <svg class="..."> onto the symbol; this ' +
  'package drops it (loader.ts skips class, style and version on purpose, but neither the ' +
  'README nor the CHANGELOG say that `class` is lost). Only styled.svg has a class.';

const KNOWN_DIFFERENCES: Known[] = [
  // ---- inline mode export shape
  {
    where: /^inline [^/]*\/[a-z-]+$/,
    field: 'url',
    reason:
      'Superset: in inline mode svg-sprite-loader exports no `url` (undefined); this package ' +
      'exports "#<id>" (README "Exported Symbol Shape" lists url for every mode).',
    holds: (d) => d.theirs === undefined && s(d.mine) === '#' + d.symbolId,
  },
  {
    where: /^inline [^/]*\/[a-z-]+$/,
    field: 'toString',
    reason:
      'Deliberate: String(icon) is the symbol markup in svg-sprite-loader and the url ("#<id>") ' +
      'here (GUARANTEES.md "stringifies to its url"; symbol.test.ts). Code that reads ' +
      'String(icon) or `${icon}` as markup is the one drop-in hazard in inline mode; code that ' +
      'uses `icon.id`, `icon.viewBox`, `icon.content` or `icon.url` is unaffected.',
    holds: (d) => s(d.theirs).startsWith('<symbol') && s(d.mine) === '#' + d.symbolId,
  },
  // ---- extract mode export shape
  {
    where: /^extract [^/]*\/[a-z-]+$/,
    field: 'id',
    reason:
      'UNDER REVIEW. In extract mode svg-sprite-loader exports id "<id>-usage" (the id of the ' +
      '<use> preview element in the sprite) and a url that ends in "#<id>-usage". This ' +
      'package exports the symbol id and "#<id>". Both work with <use href={icon.url}>, but ' +
      'only the "-usage" fragment also works where a bare fragment on a <symbol> does not ' +
      '(<img src>, CSS url()), because it targets a <use> that the sprite shows with :target. ' +
      'No README or CHANGELOG entry covers this.',
    holds: (d) => s(d.theirs) === s(d.mine) + '-usage',
  },
  {
    where: /^extract (?!spriteFilename with \[hash\])[^/]*\/[a-z-]+$/,
    field: 'url',
    reason:
      'UNDER REVIEW. Same cause as the extract "id" difference: the fragment is "#<id>-usage".',
    holds: usageFragment,
  },
  {
    where: /^extract (?!spriteFilename with \[hash\])[^/]*\/[a-z-]+$/,
    field: 'toString',
    reason: 'UNDER REVIEW. String(icon) is the url, so it carries the same "-usage" difference.',
    holds: usageFragment,
  },
  {
    where: /^extract spriteFilename with \[hash\]\/[a-z-]+$/,
    field: 'url',
    reason:
      'Documented limitation (README "Known limitations"): spriteFilename is used literally, so ' +
      '"[hash]" is not interpolated; svg-sprite-loader writes the content hash into the name. ' +
      'The fragment also has the "-usage" suffix (UNDER REVIEW, see the extract "id" entry).',
    holds: hashedUsageFragment,
  },
  {
    where: /^extract spriteFilename with \[hash\]\/[a-z-]+$/,
    field: 'toString',
    reason: 'Same as the [hash] url difference: String(icon) is the url.',
    holds: hashedUsageFragment,
  },
  {
    where: /^extract [^/]*\/[a-z-]+$/,
    field: 'content',
    reason:
      'Superset: in extract mode svg-sprite-loader exports no `content`; this package exports ' +
      'it (README "Exported Symbol Shape" lists it for every mode).',
    holds: (d) => d.theirs === '<<undefined>>' && s(d.mine).startsWith('<symbol'),
  },
  // ---- sprite file
  {
    where: /^extract spriteFilename and publicPath\/sprite$/,
    field: 'files',
    reason:
      'Documented (README "publicPath": "Public URL prefix for the sprite file"): publicPath ' +
      'only changes the url here. svg-sprite-loader also writes the file under that prefix, ' +
      'so its sprite lands in out/cdn/icons/sprite.svg and this package writes ' +
      'out/icons/sprite.svg. The urls are identical, only the file location differs.',
    holds: (d) =>
      s(d.theirs) === '["cdn/icons/sprite.svg"]' && s(d.mine) === '["icons/sprite.svg"]',
  },
  {
    where: /^extract spriteFilename with \[hash\]\/sprite$/,
    field: 'files',
    reason:
      'Documented limitation (README "Known limitations"): "[hash]" in spriteFilename is not ' +
      'interpolated, so the emitted file is literally named "sprite-[hash].svg".',
    holds: (d) =>
      Array.isArray(d.theirs) &&
      d.theirs.length === 1 &&
      SPRITE_HASHED.test(s(d.theirs[0])) &&
      s(d.mine) === '["sprite-[hash].svg"]',
  },
  {
    where: /^extract [^/]*\/sprite$/,
    field: 'preview <use> elements',
    reason:
      'UNDER REVIEW (low impact, preview only). The preview <use> elements in the sprite use ' +
      '`href` plus width="100%" height="100%" here, and `xlink:href` without a size in ' +
      'svg-sprite-loader. The README only says plainSprite drops them. `href` without ' +
      'xlink:href needs SVG 2 support (Safari 12.1 and newer).',
    holds: (d) =>
      Array.isArray(d.theirs) &&
      Array.isArray(d.mine) &&
      d.theirs.length === d.mine.length &&
      d.theirs.every((t: string) => t.includes('xlink:href=#') && !t.includes('width=')) &&
      d.mine.every((m: string) => m.includes(' href=#') && m.includes('width=100%')),
  },
  // ---- symbol markup
  {
    where: /\/(gradient|titled|xlink)$/,
    field: 'content',
    reason: PREFIX_REASON,
    holds: prefixOnly,
  },
  {
    where: /^extract [^/]*\/sprite\/.*(titled|xlink)$/i,
    field: 'markup',
    reason: PREFIX_REASON + ' (as written to the sprite file)',
    holds: prefixOnly,
  },
  {
    where: /^extract [^/]*\/sprite\/.*gradient$/i,
    field: 'markup',
    reason:
      PREFIX_REASON +
      ' In the sprite file svg-sprite-loader also moves the <linearGradient> out of the symbol ' +
      "into the sprite's top level <defs>, leaving an empty <defs> in the symbol.",
    holds: prefixAndHoist,
  },
  {
    where: /\/styled$/,
    field: 'content',
    reason: CLASS_REASON,
    holds: droppedClass,
  },
  {
    where: /^extract [^/]*\/sprite\/.*styled$/i,
    field: 'markup',
    reason: CLASS_REASON + ' (as written to the sprite file)',
    holds: droppedClass,
  },
];

const matches = (k: Known, d: Difference): boolean =>
  k.field === d.field && k.where.test(d.where) && k.holds(d);

/* ---------------------------------------------------------------- tests */

describe('drop-in parity with svg-sprite-loader', () => {
  const icons = listIcons();
  const results = new Map<string, { theirs: Built; mine: Built; diffs: Difference[] }>();

  beforeAll(async () => {
    for (const variant of VARIANTS) {
      const [theirs, mine] = await Promise.all([
        buildOne('theirs', variant, icons),
        buildOne('mine', variant, icons),
      ]);
      results.set(variant.name, {
        theirs,
        mine,
        diffs: compareBuilt(variant, icons, theirs, mine),
      });
    }
  }, 120000);

  it('compares every fixture and every parity input in every variant', () => {
    expect(icons.map((i) => i.key)).toEqual(
      expect.arrayContaining(['star', 'arrow', 'circle', 'prolog', 'no-viewbox', 'gradient']),
    );
    expect(icons.length).toBeGreaterThanOrEqual(13);
    for (const variant of VARIANTS) {
      const r = results.get(variant.name)!;
      expect(Object.keys(r.theirs.icons).sort()).toEqual(icons.map((i) => i.key).sort());
      expect(Object.keys(r.mine.icons).sort()).toEqual(icons.map((i) => i.key).sort());
    }
  });

  it('every difference is explained by the allowlist, and no allowlist entry is stale', () => {
    const all = Array.from(results.values()).flatMap((r) => r.diffs);
    const unexplained = all.filter((d) => !KNOWN_DIFFERENCES.some((k) => matches(k, d)));
    expect(
      unexplained.map(
        (d) =>
          d.where + ' [' + d.field + ']\n  theirs: ' + s(d.theirs) + '\n  mine:   ' + s(d.mine),
      ),
    ).toEqual([]);

    const stale = KNOWN_DIFFERENCES.filter((k) => !all.some((d) => matches(k, d)));
    expect(stale.map((k) => k.where + ' [' + k.field + ']')).toEqual([]);
  });

  it('inline: same id and viewBox for every icon, same symbols in the DOM', () => {
    for (const variant of VARIANTS.filter((v) => !v.extract)) {
      const r = results.get(variant.name)!;
      for (const { key } of icons) {
        expect(r.mine.icons[key]!.id).toBe(r.theirs.icons[key]!.id);
        expect(r.mine.icons[key]!.viewBox).toBe(r.theirs.icons[key]!.viewBox);
        expect(r.mine.icons[key]!.content).toEqual(expect.stringContaining('<symbol id="'));
      }
      const domIds = (b: Built) => b.dom.map((x) => x.id).sort();
      expect(domIds(r.mine)).toEqual(domIds(r.theirs));
      expect(r.mine.dom).toHaveLength(icons.length);
      expect(r.mine.files).toEqual({});
    }
  });

  it('extract: the same symbol ids and viewBoxes are in the sprite, one file', () => {
    for (const variant of VARIANTS.filter((v) => v.extract)) {
      const r = results.get(variant.name)!;
      expect(Object.keys(r.mine.files)).toHaveLength(1);
      const sprite = (b: Built) => readSprite(Object.values(b.files)[0]!).symbols;
      const view = (m: ReturnType<typeof sprite>) =>
        Array.from(m.entries())
          .map(([id, v]) => id + ' ' + v.viewBox)
          .sort();
      expect(view(sprite(r.mine))).toEqual(view(sprite(r.theirs)));
      expect(sprite(r.mine).size).toBe(icons.length);
    }
  });

  it('keeps real differences visible: the normalizer only does what the header says', () => {
    expect(
      normalizeMarkup('<symbol xmlns="' + SVG_NS + '" id="a" viewBox="0 0 1 1"><g/></symbol>'),
    ).toBe(normalizeMarkup('<symbol viewBox="0 0 1 1" id="a">\n  <g />\n</symbol>'));
    const base = normalizeMarkup('<symbol id="a"><g fill="red"/></symbol>');
    expect(normalizeMarkup('<symbol id="a"><g fill="blue"/></symbol>')).not.toBe(base);
    expect(normalizeMarkup('<symbol id="b"><g fill="red"/></symbol>')).not.toBe(base);
    expect(normalizeMarkup('<symbol id="a" class="x"><g fill="red"/></symbol>')).not.toBe(base);
    expect(normalizeMarkup('<symbol id="a"><g fill="red"/><!-- c --></symbol>')).not.toBe(base);
    expect(normalizeMarkup('<symbol id="a"><g fill="red">t</g></symbol>')).not.toBe(base);
    expect(normalizeMarkup('<symbol viewbox="0"/>')).not.toBe(
      normalizeMarkup('<symbol viewBox="0"/>'),
    );
  });

  it('this package gives the same output on Rspack 1, Rspack 2 and webpack 5', async () => {
    for (const name of ['extract spriteFilename and publicPath', 'inline symbolId pattern']) {
      const variant = VARIANTS.find((v) => v.name === name)!;
      const base = results.get(variant.name)!.mine;
      for (const { impl } of ALL_BUNDLERS) {
        const built = await buildOne('mine', variant, icons, impl);
        expect(built.icons).toEqual(base.icons);
        expect(built.dom).toEqual(base.dom);
        expect(built.files).toEqual(base.files);
      }
    }
  }, 120000);
});
