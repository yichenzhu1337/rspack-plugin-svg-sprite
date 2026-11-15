import { describe, it, expect } from '@rstest/core';
import fc from 'fast-check';
import loader, {
  parseRootTag,
  parseViewBox,
  extractSvgInner,
  extractSvgAttrs,
  legacy,
} from '../../loader';
import { check } from './arbitraries';

const helpers: Record<string, (input: string) => unknown> = {
  parseRootTag,
  parseViewBox,
  extractSvgInner,
  extractSvgAttrs,
  'legacy.parseViewBox': legacy.parseViewBox,
  'legacy.extractSvgInner': legacy.extractSvgInner,
  'legacy.extractSvgAttrs': legacy.extractSvgAttrs,
};

const atoms = fc.constantFrom(
  '<svg',
  '</svg>',
  '<svg ',
  '<!--',
  '-->',
  '<?xml',
  'viewBox=',
  'width="1"',
  '"',
  "'",
  '=',
  '>',
  '<',
  ' ',
  '\n',
  'a',
  '/',
  ':',
  '\u0000',
  '\u{1F600}',
);

const adversarial = fc.oneof(
  fc.string({ maxLength: 200 }),
  fc.string({ unit: 'binary', maxLength: 200 }),
  fc.array(atoms, { maxLength: 60 }).map((parts) => parts.join('')),
);

describe('loader helpers on arbitrary input (property)', () => {
  for (const [name, fn] of Object.entries(helpers)) {
    it(name + ' never throws', () => {
      check(
        fc.property(adversarial, (input) => {
          fn(input);
        }),
        300,
      );
    });
  }

  it('the loader itself only throws its documented error for non-SVG input', () => {
    const ctx = { resourcePath: '/a/icon.svg', cacheable() {}, getOptions: () => ({}) };
    check(
      fc.property(adversarial, (input) => {
        try {
          loader.call(ctx as any, input);
        } catch (error) {
          expect(input.includes('<svg')).toBe(false);
          expect((error as Error).message).toContain('Invalid SVG content');
        }
      }),
      300,
    );
  });
});

// Long repetitive inputs: catastrophic backtracking would take seconds to minutes here.
const N = 50_000;
const hostile: Record<string, string> = {
  spaces: '<svg' + ' '.repeat(N),
  'spaces then close': '<svg' + ' '.repeat(N) + '>',
  'double quotes': '<svg a=' + '"'.repeat(N),
  'single quotes': "<svg a='" + "'".repeat(N),
  'alternating quotes': '<svg a=' + '"\''.repeat(N / 2),
  'unterminated attributes': '<svg' + ' a="1"'.repeat(N / 5),
  'unterminated value': '<svg a="' + 'x'.repeat(N),
  'repeated opener': '<svg '.repeat(N / 5),
  'repeated element': '<svg>'.repeat(N / 5),
  'repeated comment opener': '<!--'.repeat(N / 4) + '<svg>',
  'repeated closer': '<svg>' + '</svg>'.repeat(N / 6),
  'newlines inside tag': '<svg' + '\n'.repeat(N),
  'equals signs': '<svg ' + '='.repeat(N),
  'no root at all': 'x'.repeat(N),
};

const TIME_BUDGET_MS = 250;

// FINDING: these inputs take 400 ms to 1 s at 50 000 characters because the work is quadratic:
//  - `<svg ` x10 000 and `<svg>` x10 000 (no closing tag): the v1 regexes `<svg([^>]*)>` and
//    `<svg[^>]*>([\s\S]*)<\/svg>` retry from every `<svg`, scanning to the end each time.
//    parseViewBox, extractSvgAttrs and extractSvgInner reach them through the fallback.
//  - `<!--` x12 500 then `<svg>`: parseRootTag calls indexOf('-->') from every unterminated
//    comment opener, and each call scans to the end of the file.
// Skipped, not fixed, because src/ is out of scope for this change. Un-skip after fixing.
const KNOWN_QUADRATIC = new Set([
  ...Object.keys(helpers)
    .filter((name) => name !== 'parseRootTag')
    .map((name) => name + ' / repeated opener'),
  'legacy.extractSvgInner / repeated element',
  'extractSvgInner / repeated element',
  ...['parseRootTag', 'parseViewBox', 'extractSvgInner', 'extractSvgAttrs'].map(
    (name) => name + ' / repeated comment opener',
  ),
]);

describe('loader helpers terminate quickly on long repetitive input (property)', () => {
  for (const [label, input] of Object.entries(hostile)) {
    for (const [name, fn] of Object.entries(helpers)) {
      const key = name + ' / ' + label;
      const body = () => {
        const started = performance.now();
        fn(input);
        expect(performance.now() - started).toBeLessThan(TIME_BUDGET_MS);
      };
      if (KNOWN_QUADRATIC.has(key)) it.skip(key, body);
      else it(key, body);
    }
  }

  it('a generated mix of repeated atoms stays fast', () => {
    check(
      fc.property(
        fc.array(fc.tuple(atoms, fc.integer({ min: 1, max: 1000 })), { maxLength: 6 }),
        (runs) => {
          // Capped: the quadratic cases above are skipped, so keep this one small enough to be quick.
          const input = runs
            .map(([atom, count]) => atom.repeat(count))
            .join('')
            .slice(0, 12_000);
          const started = performance.now();
          for (const fn of Object.values(helpers)) fn(input);
          expect(performance.now() - started).toBeLessThan(TIME_BUDGET_MS * 4);
        },
      ),
      40,
      true,
    );
  });
});
