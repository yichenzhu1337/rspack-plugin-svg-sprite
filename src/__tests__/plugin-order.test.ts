import { describe, it, expect } from '@rstest/core';
import SvgSpritePlugin from '../plugin';

function emit(plugin: InstanceType<typeof SvgSpritePlugin>, add: () => void) {
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
    hooks: {
      thisCompilation: {
        tap(_name: string, fn: (c: unknown) => void) {
          fn(compilation);
        },
      },
    },
  };
  plugin.apply(compiler as any);
  add();
  processAssets();
  return emitted;
}

const symbol = (id: string, spriteFilename = 'sprite.svg') => ({
  id,
  content: '<symbol id="' + id + '"/>',
  spriteFilename,
});

const order = (sprite: string, pattern: RegExp) => {
  const found: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sprite)) !== null) found.push(match[1]);
  return found;
};

describe('sprite symbol order', () => {
  it('emits symbols and usages sorted by id, whatever order the loaders finished in', () => {
    const plugin = new SvgSpritePlugin();
    const emitted = emit(plugin, () => {
      ['m', 'z', 'a', 'B', 'a-2'].forEach((id) => plugin.addSymbol(symbol(id)));
    });
    expect(order(emitted['sprite.svg'], /<symbol id="([^"]+)"/g)).toEqual([
      'B',
      'a',
      'a-2',
      'm',
      'z',
    ]);
    expect(order(emitted['sprite.svg'], /<use id="([^"]+)-usage"/g)).toEqual([
      'B',
      'a',
      'a-2',
      'm',
      'z',
    ]);
  });

  it('produces the same sprite for any registration order', () => {
    const build = (ids: string[]) => {
      const plugin = new SvgSpritePlugin({ plainSprite: true });
      return emit(plugin, () => ids.forEach((id) => plugin.addSymbol(symbol(id))))['sprite.svg'];
    };
    expect(build(['c', 'a', 'b'])).toBe(build(['a', 'b', 'c']));
    expect(build(['b', 'c', 'a'])).toBe(build(['a', 'b', 'c']));
  });

  it('sorts each sprite file independently', () => {
    const plugin = new SvgSpritePlugin();
    const emitted = emit(plugin, () => {
      plugin.addSymbol(symbol('y', 'one.svg'));
      plugin.addSymbol(symbol('d', 'two.svg'));
      plugin.addSymbol(symbol('x', 'one.svg'));
      plugin.addSymbol(symbol('c', 'two.svg'));
    });
    expect(order(emitted['one.svg'], /<symbol id="([^"]+)"/g)).toEqual(['x', 'y']);
    expect(order(emitted['two.svg'], /<symbol id="([^"]+)"/g)).toEqual(['c', 'd']);
  });

  it('does not reorder plugin.symbols itself', () => {
    const plugin = new SvgSpritePlugin();
    emit(plugin, () => ['z', 'a'].forEach((id) => plugin.addSymbol(symbol(id))));
    expect(plugin.symbols.map((s) => s.id)).toEqual(['z', 'a']);
  });

  it('keeps entries with equal ids next to each other', () => {
    const plugin = new SvgSpritePlugin();
    const emitted = emit(plugin, () => {
      // addSymbol de-duplicates by id, so equal ids can only arrive through the public field.
      plugin.symbols.push(symbol('b'), symbol('a'), symbol('b'));
    });
    expect(order(emitted['sprite.svg'], /<symbol id="([^"]+)"/g)).toEqual(['a', 'b', 'b']);
  });

  it('generateSprite keeps the order it is given (unchanged public method)', () => {
    const sprite = new SvgSpritePlugin().generateSprite([symbol('z'), symbol('a')]);
    expect(order(sprite, /<symbol id="([^"]+)"/g)).toEqual(['z', 'a']);
  });
});
