import { describe, it, expect } from '@rstest/core';
import fs from 'fs';
import path from 'path';
import { Parser } from 'htmlparser2';
import loader from '../loader';

/**
 * Real-world icon corpus (see fixtures/corpus/NOTICE.md). Every file goes through the loader and
 * is checked against invariants that do not depend on the loader's own parsing code.
 */

const CORPUS = path.resolve(process.cwd(), 'src/__tests__/fixtures/corpus/icons');
const FILES = fs
  .readdirSync(CORPUS)
  .filter((name) => name.endsWith('.svg'))
  .sort();

interface Symbol {
  id: string;
  viewBox: string;
  content: string;
}

function runLoader(file: string): Symbol {
  const fullPath = path.join(CORPUS, file);
  const source = fs.readFileSync(fullPath, 'utf8');
  const ctx = {
    resourcePath: fullPath,
    cacheable() {},
    getOptions: () => ({}),
    _compiler: { context: CORPUS },
    _compilation: {},
  };
  const js: string = loader.call(ctx as any, source);
  const match = /new SpriteSymbol\((\{.*\})\);\n/.exec(js);
  if (!match) throw new Error('no symbol in loader output for ' + file);
  return JSON.parse(match[1]!);
}

interface Parsed {
  /** Element names in document order. */
  names: string[];
  /** `d` attributes in document order, byte for byte. */
  paths: string[];
  roots: Array<{ name: string; attrs: Record<string, string> }>;
  problems: string[];
}

/** Parses markup as XML (raw attribute text) and records what the invariants compare. */
function parse(xml: string): Parsed {
  const out: Parsed = { names: [], paths: [], roots: [], problems: [] };
  const stack: string[] = [];
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (stack.length === 0) out.roots.push({ name, attrs });
        stack.push(name);
        out.names.push(name);
        if (attrs.d !== undefined) out.paths.push(attrs.d);
      },
      onclosetag(name, implied) {
        const selfClosed = xml.slice(parser.endIndex - 1, parser.endIndex + 1) === '/>';
        if (implied && !selfClosed) out.problems.push('implied close of <' + name + '>');
        if (stack.pop() !== name) out.problems.push('mismatched close of <' + name + '>');
      },
      onattribute(name, value) {
        if (value.includes('<')) out.problems.push('raw "<" in attribute ' + name);
      },
      onerror(err) {
        out.problems.push(err.message);
      },
    },
    { xmlMode: true, decodeEntities: false },
  );
  parser.write(xml);
  parser.end();
  if (stack.length > 0) out.problems.push('unclosed: ' + stack.join(','));
  return out;
}

/** Entities other than the five predefined ones and numeric references, outside CDATA/comments. */
function undeclaredEntities(xml: string): string[] {
  const text = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  return text.match(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)[^\s<"']{0,12}/g) ?? [];
}

/** The documented viewBox rule, written out independently of the loader. */
function expectedViewBox(source: string): string {
  const root = parse(source.replace(/^﻿/, '')).roots[0];
  const attrs = root && root.name === 'svg' ? root.attrs : {};
  if (attrs.viewBox) return attrs.viewBox;
  const size = /^(\d+(?:\.\d+)?)(?:px)?$/;
  const w = size.exec(attrs.width ?? '');
  const h = size.exec(attrs.height ?? '');
  return w && h ? '0 0 ' + w[1] + ' ' + h[1] : '0 0 24 24';
}

/**
 * Corpus files that hit a documented limitation (README "Known limitations"). The expected
 * behaviour is asserted instead of the general invariant.
 */
const DOCUMENTED_ENTITY_FILES = new Set(['messy--doctype-entities.svg']);

/**
 * UNDER REVIEW cases: real defects found by the corpus. Each is marked `fails`, so the suite
 * goes red when the defect is fixed and the entry can be removed.
 */
const UNDER_REVIEW: Record<string, string> = {
  // `<svg/>` has no closing tag, so the loader falls back to v1 and wraps the whole source:
  // the symbol is `<symbol ...><svg/>\n</symbol>`, a nested <svg> instead of an empty symbol.
  // The same happens for `<svg viewBox="0 0 1 1"/>`.
  'messy--empty-svg.svg': 'self-closing root keeps a nested <svg/> inside the symbol',
};

describe('real-world corpus', () => {
  it('has a meaningful size', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(150);
    expect(FILES.length).toBeLessThanOrEqual(300);
    const prefixes = new Set(FILES.map((f) => f.split('--')[0]));
    expect(Array.from(prefixes).sort()).toEqual([
      'bootstrap',
      'fontawesome',
      'heroicons',
      'lucide',
      'material',
      'messy',
      'simple-icons',
      'tabler',
    ]);
  });

  for (const file of FILES) {
    const check = UNDER_REVIEW[file] ? it.fails : it;
    check(file + (UNDER_REVIEW[file] ? ' (UNDER REVIEW: ' + UNDER_REVIEW[file] + ')' : ''), () => {
      const source = fs.readFileSync(path.join(CORPUS, file), 'utf8');
      const symbol = runLoader(file);

      // Deterministic.
      expect(runLoader(file)).toEqual(symbol);

      // Exactly one <symbol> root, with the expected id and viewBox.
      const out = parse(symbol.content);
      expect(out.roots.map((r) => r.name)).toEqual(['symbol']);
      expect(out.roots[0]!.attrs.id).toBe(path.basename(file, '.svg'));
      expect(symbol.id).toBe(path.basename(file, '.svg'));
      expect(symbol.viewBox).toBe(expectedViewBox(source));
      expect(out.roots[0]!.attrs.viewBox).toBe(symbol.viewBox);

      // Well-formed XML. A DOCTYPE entity is the documented exception: it stays undeclared.
      expect(out.problems).toEqual([]);
      if (DOCUMENTED_ENTITY_FILES.has(file)) {
        expect(undeclaredEntities(symbol.content)).toEqual(['&st0;']);
      } else {
        expect(undeclaredEntities(symbol.content)).toEqual([]);
      }

      // Every element and every path `d` survives, in order, byte for byte.
      const src = parse(source.replace(/^﻿/, ''));
      const srcNames = src.names.slice(src.names.indexOf('svg') + 1);
      expect(out.names.slice(1)).toEqual(srcNames);
      expect(out.paths).toEqual(src.paths);
    });
  }

  it('matches the golden output for the whole corpus', async () => {
    const golden = FILES.map((file) => {
      const s = runLoader(file);
      return '=== ' + file + '\n' + s.id + '\n' + s.viewBox + '\n' + s.content + '\n';
    }).join('');
    await expect(golden).toMatchFileSnapshot(
      path.resolve(process.cwd(), 'src/__tests__/__snapshots__/corpus.golden.txt'),
    );
  });
});
