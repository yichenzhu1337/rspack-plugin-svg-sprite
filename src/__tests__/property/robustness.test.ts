import { describe, it, expect } from '@rstest/core';
import fc from 'fast-check';
import loader, {
  parseRootTag,
  parseViewBox,
  extractSvgInner,
  extractSvgAttrs,
  legacy,
} from '../../loader';
import { check, growthRatio, MAX_GROWTH_RATIO, HANG_LIMIT_MS } from './arbitraries';

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

// Long repetitive inputs: catastrophic backtracking would take seconds to minutes here. These
// check linearity by comparing the time at two sizes (see `growthRatio`), not a wall-clock limit,
// so they hold on a loaded machine. `size` is the input length in characters, roughly.
const N = 50_000;
const shapes: Record<string, (size: number) => string> = {
  spaces: (n) => '<svg' + ' '.repeat(n),
  'spaces then close': (n) => '<svg' + ' '.repeat(n) + '>',
  'double quotes': (n) => '<svg a=' + '"'.repeat(n),
  'single quotes': (n) => "<svg a='" + "'".repeat(n),
  'alternating quotes': (n) => '<svg a=' + '"\''.repeat(n / 2),
  'unterminated attributes': (n) => '<svg' + ' a="1"'.repeat(n / 5),
  'unterminated value': (n) => '<svg a="' + 'x'.repeat(n),
  'repeated opener': (n) => '<svg '.repeat(n / 5),
  'repeated element': (n) => '<svg>'.repeat(n / 5),
  'repeated comment opener': (n) => '<!--'.repeat(n / 4) + '<svg>',
  'repeated closer': (n) => '<svg>' + '</svg>'.repeat(n / 6),
  'newlines inside tag': (n) => '<svg' + '\n'.repeat(n),
  'equals signs': (n) => '<svg ' + '='.repeat(n),
  'no root at all': (n) => 'x'.repeat(n),
};

describe('loader helpers take linear time on long repetitive input (property)', () => {
  for (const [label, make] of Object.entries(shapes)) {
    for (const [name, fn] of Object.entries(helpers)) {
      it(name + ' / ' + label, () => {
        expect(growthRatio(make, fn, N, 7)).toBeLessThan(MAX_GROWTH_RATIO);
      });
    }
  }

  // The same kind of shapes up to 1 MB, through every helper and the loader itself.
  const BIG = 1_000_000;
  const big: Record<string, (size: number) => string> = {
    'repeated opener': (n) => '<svg '.repeat(n / 5),
    'repeated element': (n) => '<svg>'.repeat(n / 5),
    'repeated comment opener': (n) => '<!--'.repeat(n / 4) + '<svg>',
    'repeated closer': (n) => '<svg>' + '</svg>'.repeat(n / 6),
    'long attribute name': (n) => '<svg ' + 'a'.repeat(n),
    'long unterminated attribute run': (n) => '<svg ' + 'a="1" '.repeat(n / 6),
    'repeated doctype': (n) => '<!DOCTYPE svg [' + '<!ENTITY a "b">'.repeat(n / 15) + '<svg>',
  };
  for (const [label, make] of Object.entries(big)) {
    it('1 MB ' + label + ' takes linear time through the loader', () => {
      const ctx = {
        resourcePath: '/a/icon.svg',
        cacheable() {},
        getOptions: () => ({}),
        emitWarning() {},
      };
      const run = (input: string) => {
        for (const fn of Object.values(helpers)) fn(input);
        loader.call(ctx as any, input);
      };
      // 125 KB against 1 MB: a quadratic path would be about 8 times slower than linear here.
      expect(growthRatio(make, run, BIG / 8, 7)).toBeLessThan(MAX_GROWTH_RATIO);
    });
  }

  it('a generated mix of repeated atoms does not hang', () => {
    check(
      fc.property(
        fc.array(fc.tuple(atoms, fc.integer({ min: 1, max: 1000 })), { maxLength: 6 }),
        (runs) => {
          const input = runs
            .map(([atom, count]) => atom.repeat(count))
            .join('')
            .slice(0, 12_000);
          const started = performance.now();
          for (const fn of Object.values(helpers)) fn(input);
          expect(performance.now() - started).toBeLessThan(HANG_LIMIT_MS);
        },
      ),
      40,
      true,
    );
  });
});
