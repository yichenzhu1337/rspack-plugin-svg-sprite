import { describe, it, expect } from '@rstest/core';
import fc from 'fast-check';
import SvgSpritePlugin from '../../plugin';
import { check } from './arbitraries';

function emit(symbols: Array<{ id: string; content: string }>, plainSprite: boolean): string {
  const plugin = new SvgSpritePlugin({ plainSprite });
  const emitted: Record<string, string> = {};
  let processAssets: () => void = () => {};
  const compilation = {
    emitAsset(name: string, source: { source(): string }) {
      emitted[name] = source.source();
    },
    hooks: {
      processAssets: {
        tap(_options: unknown, fn: () => void) {
          processAssets = fn;
        },
      },
    },
  };
  const compiler = {
    rspack: {
      Compilation: { PROCESS_ASSETS_STAGE_ADDITIONAL: -2000 },
      sources: {
        RawSource: class {
          constructor(private text: string) {}
          source() {
            return this.text;
          }
        },
      },
    },
    hooks: { thisCompilation: { tap: (_n: string, fn: (c: unknown) => void) => fn(compilation) } },
  };
  plugin.apply(compiler as any);
  for (const s of symbols) plugin.addSymbol({ ...s, spriteFilename: 'sprite.svg' });
  processAssets();
  return emitted['sprite.svg'];
}

const idChar = fc.constantFrom(...'abcXYZ019_-.'.split(''));
const id = fc.array(idChar, { minLength: 1, maxLength: 6 }).map((c) => c.join(''));

const symbols = fc
  .uniqueArray(id, { minLength: 1, maxLength: 12 })
  .map((ids) =>
    ids.map((i) => ({ id: i, content: '<symbol id="' + i + '"><path d="M0 0"/></symbol>' })),
  );

const occurrences = (text: string, needle: string) => text.split(needle).length - 1;

describe('sprite generation (property)', () => {
  it('contains each symbol and each usage exactly once', () => {
    check(
      fc.property(symbols, (list) => {
        const sprite = emit(list, false);
        for (const s of list) {
          expect(occurrences(sprite, '<symbol id="' + s.id + '">')).toBe(1);
          expect(occurrences(sprite, '<use id="' + s.id + '-usage" href="#' + s.id + '"')).toBe(1);
        }
        expect(occurrences(sprite, '<symbol ')).toBe(list.length);
        expect(occurrences(sprite, '<use ')).toBe(list.length);
      }),
    );
  });

  it('is identical for any registration order, and sorted by id', () => {
    check(
      fc.property(
        symbols.chain((list) =>
          fc.tuple(
            fc.constant(list),
            fc.shuffledSubarray(list, { minLength: list.length, maxLength: list.length }),
          ),
        ),
        fc.boolean(),
        ([list, shuffled], plainSprite) => {
          const sprite = emit(list, plainSprite);
          expect(emit(shuffled, plainSprite)).toBe(sprite);

          const order = [...sprite.matchAll(/<symbol id="([^"]*)"/g)].map((m) => m[1]);
          expect(order).toEqual(list.map((s) => s.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
        },
      ),
    );
  });

  it('keeps the last registration when an id is added twice', () => {
    check(
      fc.property(symbols, (list) => {
        const first = list[0];
        const replaced = { id: first.id, content: '<symbol id="' + first.id + '">v2</symbol>' };
        const sprite = emit([...list, replaced], true);
        expect(occurrences(sprite, '<symbol id="' + first.id + '">')).toBe(1);
        expect(sprite).toContain('>v2</symbol>');
      }),
    );
  });
});
