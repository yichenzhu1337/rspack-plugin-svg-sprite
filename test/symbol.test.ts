import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import SpriteSymbol from '../dist/runtime/symbol';

describe('SpriteSymbol', () => {
  it('stores id, viewBox, and content from constructor data', () => {
    const sym = new SpriteSymbol({
      id: 'icon-arrow',
      viewBox: '0 0 24 24',
      content: '<symbol id="icon-arrow" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>',
    });

    assert.equal(sym.id, 'icon-arrow');
    assert.equal(sym.viewBox, '0 0 24 24');
    assert.ok(sym.content!.includes('<symbol'));
  });

  it('.url returns a fragment reference "#id"', () => {
    const sym = new SpriteSymbol({ id: 'star', viewBox: '0 0 32 32', content: '' });
    assert.equal(sym.url, '#star');
  });

  it('.useUrl returns the same fragment reference as .url', () => {
    const sym = new SpriteSymbol({ id: 'star', viewBox: '0 0 32 32', content: '' });
    assert.equal(sym.useUrl, '#star');
    assert.equal(sym.useUrl, sym.url);
  });

  it('.toString() returns the url for easy template interpolation', () => {
    const sym = new SpriteSymbol({ id: 'circle', viewBox: '0 0 100 100', content: '' });
    assert.equal(`${sym}`, '#circle');
    assert.equal(sym.toString(), '#circle');
  });

  it('.stringify() returns the raw symbol content', () => {
    const content = '<symbol id="x" viewBox="0 0 10 10"><rect/></symbol>';
    const sym = new SpriteSymbol({ id: 'x', viewBox: '0 0 10 10', content });
    assert.equal(sym.stringify(), content);
  });

  it('.destroy() nullifies all properties', () => {
    const sym = new SpriteSymbol({ id: 'temp', viewBox: '0 0 1 1', content: '<symbol/>' });
    sym.destroy();
    assert.equal(sym.id, null);
    assert.equal(sym.viewBox, null);
    assert.equal(sym.content, null);
  });
});
