import { describe, it, expect } from '@rstest/core';
import SpriteSymbol from '../runtime/symbol';

describe('SpriteSymbol', () => {
  it('stores id, viewBox, and content from constructor data', () => {
    const sym = new SpriteSymbol({
      id: 'icon-arrow',
      viewBox: '0 0 24 24',
      content: '<symbol id="icon-arrow" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>',
    });

    expect(sym.id).toBe('icon-arrow');
    expect(sym.viewBox).toBe('0 0 24 24');
    expect(sym.content).toContain('<symbol');
  });

  it('.url returns a fragment reference "#id"', () => {
    const sym = new SpriteSymbol({ id: 'star', viewBox: '0 0 32 32', content: '' });
    expect(sym.url).toBe('#star');
  });

  it('.url returns a custom url when set', () => {
    const sym = new SpriteSymbol({ id: 'star', viewBox: '0 0 32 32', content: '' });
    sym.url = '/sprite.svg#star';
    expect(sym.url).toBe('/sprite.svg#star');
  });

  it('.url returns the constructor url if provided', () => {
    const sym = new SpriteSymbol({
      id: 'x',
      viewBox: '0 0 1 1',
      content: '',
      url: '/icons.svg#x',
    });
    expect(sym.url).toBe('/icons.svg#x');
  });

  it('.useUrl returns the same fragment reference as .url', () => {
    const sym = new SpriteSymbol({ id: 'star', viewBox: '0 0 32 32', content: '' });
    expect(sym.useUrl).toBe('#star');
    expect(sym.useUrl).toBe(sym.url);
  });

  it('.toString() returns the url for easy template interpolation', () => {
    const sym = new SpriteSymbol({ id: 'circle', viewBox: '0 0 100 100', content: '' });
    expect(`${sym}`).toBe('#circle');
    expect(sym.toString()).toBe('#circle');
  });

  it('.stringify() returns the raw symbol content', () => {
    const content = '<symbol id="x" viewBox="0 0 10 10"><rect/></symbol>';
    const sym = new SpriteSymbol({ id: 'x', viewBox: '0 0 10 10', content });
    expect(sym.stringify()).toBe(content);
  });

  it('.destroy() nullifies all properties', () => {
    const sym = new SpriteSymbol({ id: 'temp', viewBox: '0 0 1 1', content: '<symbol/>' });
    sym.destroy();
    expect(sym.id).toBeNull();
    expect(sym.viewBox).toBeNull();
    expect(sym.content).toBeNull();
  });
});
