import { describe, it, expect } from '@rstest/core';
import SvgSpritePlugin from '../plugin';

const sym = (id: string, content = `<symbol id="${id}"/>`) => ({
  id,
  viewBox: '0 0 1 1',
  content,
  spriteFilename: 'sprite.svg',
});

describe('addSymbol keeps one entry per id', () => {
  it('replaces a symbol with the same id in place and keeps insertion order', () => {
    const plugin = new SvgSpritePlugin();
    plugin.addSymbol(sym('a'));
    plugin.addSymbol(sym('b'));
    plugin.addSymbol(sym('a', 'new'));
    expect(plugin.symbols.map((s) => s.id)).toEqual(['a', 'b']);
    expect(plugin.symbols[0].content).toBe('new');
  });

  it('handles thousands of symbols without duplicates', () => {
    const plugin = new SvgSpritePlugin();
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 3000; i++) plugin.addSymbol(sym(`icon-${i}`, String(round)));
    }
    expect(plugin.symbols).toHaveLength(3000);
    expect(plugin.symbols.every((s) => s.content === '1')).toBe(true);
  });

  it('sees symbols when the public array is replaced from outside', () => {
    const plugin = new SvgSpritePlugin();
    plugin.addSymbol(sym('a'));
    plugin.symbols = [sym('x'), sym('y')];
    plugin.addSymbol(sym('y', 'new'));
    plugin.addSymbol(sym('a'));
    expect(plugin.symbols.map((s) => s.id)).toEqual(['x', 'y', 'a']);
    expect(plugin.symbols[1].content).toBe('new');
  });

  it('sees symbols pushed or removed from outside', () => {
    const plugin = new SvgSpritePlugin();
    plugin.addSymbol(sym('a'));
    plugin.symbols.push(sym('b'));
    plugin.addSymbol(sym('b', 'new'));
    expect(plugin.symbols.map((s) => s.id)).toEqual(['a', 'b']);
    expect(plugin.symbols[1].content).toBe('new');
    plugin.symbols.length = 0;
    plugin.addSymbol(sym('b'));
    expect(plugin.symbols.map((s) => s.id)).toEqual(['b']);
  });

  it('recovers when an entry is swapped in place from outside', () => {
    const plugin = new SvgSpritePlugin();
    plugin.addSymbol(sym('a'));
    plugin.addSymbol(sym('b'));
    plugin.symbols[0] = sym('c');
    plugin.addSymbol(sym('a'));
    plugin.addSymbol(sym('c', 'new'));
    expect(plugin.symbols.map((s) => s.id)).toEqual(['c', 'b', 'a']);
    expect(plugin.symbols[0].content).toBe('new');
  });
});
