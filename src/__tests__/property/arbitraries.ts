import fc from 'fast-check';

/**
 * Fixed seed so a CI failure is reproducible. fast-check prints the seed, the path and the
 * shrunk counterexample on failure; to explore other inputs run with `PROPERTY_SEED=<n>`.
 */
const SEED = process.env.PROPERTY_SEED ? Number(process.env.PROPERTY_SEED) : 20240615;

export function check<T>(
  property: fc.IPropertyWithHooks<T>,
  numRuns = 150,
  endOnFailure = false,
): void {
  // `endOnFailure` skips shrinking, which is the right call for slow properties.
  fc.assert(property, { seed: SEED, numRuns, endOnFailure });
}

const nameStart = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_'.split(''),
);
const nameRest = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-.'.split(''),
);
const ncName = fc
  .tuple(nameStart, fc.array(nameRest, { maxLength: 8 }))
  .map(([first, rest]) => first + rest.join(''));

/** Plain, prefixed (`xlink:href`) and mixed case attribute names. */
export const attrName = fc.oneof(
  ncName,
  fc.tuple(ncName, ncName).map(([prefix, local]) => prefix + ':' + local),
);

const valueChar = fc.constantFrom(
  ...['a', 'Z', '0', ' ', '>', '<', '/', '=', '&amp;', '&#x26;', '&lt;', ';', '-', '#', '.', '\n'],
  "'",
  '"',
);

/** A quoted attribute value (raw, as written) and the quote that delimits it. */
export const attrValue = fc
  .tuple(fc.array(valueChar, { maxLength: 12 }), fc.constantFrom('"', "'"))
  .map(([chars, quote]) => ({
    quote,
    raw: chars.join('').split(quote).join(''),
  }));

/** One or more XML whitespace characters. */
export const space = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 4 })
  .map((chars) => chars.join(''));

const optionalSpace = fc.oneof(fc.constant(''), space);

const commentBody = fc
  .array(fc.constantFrom('a', ' ', '<svg viewBox="1 1 1 1">', '<', '>', '\n', '</svg>'), {
    maxLength: 5,
  })
  .map((parts) => parts.join(''));

/** Things XML allows before the root element. */
export const prolog = fc
  .array(
    fc.oneof(
      fc.constant('<?xml version="1.0" encoding="UTF-8" standalone="no"?>'),
      fc.constant(
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">',
      ),
      commentBody.map((body) => '<!--' + body + '-->'),
      space,
    ),
    { maxLength: 4 },
  )
  .map((parts) => parts.join(''));

export interface GeneratedRoot {
  /** Text up to and including the `>` that ends the root open tag. */
  text: string;
  attrs: Array<[string, string]>;
}

/** A well-formed root open tag together with the attributes it was built from. */
export const rootTag = (names: fc.Arbitrary<string> = attrName): fc.Arbitrary<GeneratedRoot> =>
  fc
    .tuple(
      prolog,
      fc.array(fc.record({ name: names, value: attrValue, before: space, around: optionalSpace }), {
        maxLength: 6,
      }),
      optionalSpace,
    )
    .map(([pre, attrs, tail]) => {
      let text = pre + '<svg';
      for (const a of attrs) {
        text += a.before + a.name + a.around + '=' + a.around + a.value.quote + a.value.raw;
        text += a.value.quote;
      }
      text += tail + '>';
      return { text, attrs: attrs.map((a): [string, string] => [a.name, a.value.raw]) };
    });
