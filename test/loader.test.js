const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const loader = require('../loader');

const FIXTURES = path.resolve(__dirname, 'fixtures');

function createMockLoaderContext(resourcePath, options = {}) {
  return {
    resourcePath,
    cacheable() {},
    getOptions() {
      return options;
    },
    _compiler: { context: FIXTURES },
    _compilation: {},
  };
}

function runLoader(svgPath, options = {}) {
  const fullPath = path.resolve(FIXTURES, svgPath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const ctx = createMockLoaderContext(fullPath, options);
  return loader.call(ctx, content);
}

describe('Loader', () => {
  describe('SVG parsing', () => {
    it('generates a <symbol> wrapping the SVG inner content', () => {
      const output = runLoader('arrow.svg');
      assert.ok(output.includes('<symbol'));
      assert.ok(output.includes('</symbol>'));
      assert.ok(output.includes('<path'));
    });

    it('extracts the viewBox from the source SVG', () => {
      const output = runLoader('arrow.svg');
      assert.ok(output.includes('0 0 24 24'));
    });

    it('preserves stroke/fill attributes from the original SVG', () => {
      const output = runLoader('arrow.svg');
      // Attributes are inside a JSON.stringify'd string, so quotes are escaped
      assert.ok(output.includes('stroke=\\"currentColor\\"'));
      assert.ok(output.includes('stroke-width=\\"2\\"'));
    });

    it('strips width/height from the generated symbol', () => {
      const output = runLoader('arrow.svg');
      assert.ok(!output.includes('width="24"'));
      assert.ok(!output.includes('height="24"'));
    });
  });

  describe('symbolId generation', () => {
    it('defaults to [name] pattern (filename without extension)', () => {
      const output = runLoader('star.svg');
      assert.ok(output.includes('id":"star"') || output.includes('id\\":\\"star\\"'));
    });

    it('supports custom string patterns like "icon-[name]"', () => {
      const output = runLoader('star.svg', { symbolId: 'icon-[name]' });
      assert.ok(output.includes('icon-star'));
    });

    it('supports [folder] placeholder', () => {
      const output = runLoader('circle.svg', { symbolId: '[folder]-[name]' });
      assert.ok(output.includes('fixtures-circle'));
    });

    it('supports a function for symbolId', () => {
      const output = runLoader('arrow.svg', {
        symbolId: (filePath) => 'custom-' + path.basename(filePath, '.svg'),
      });
      assert.ok(output.includes('custom-arrow'));
    });
  });

  describe('inline mode (default)', () => {
    it('generates require() calls for SpriteSymbol and browser-sprite', () => {
      const output = runLoader('star.svg');
      assert.ok(output.includes('require('));
      assert.ok(output.includes('symbol.js'));
      assert.ok(output.includes('browser-sprite.js'));
    });

    it('calls sprite.add(symbol) to register the symbol', () => {
      const output = runLoader('star.svg');
      assert.ok(output.includes('sprite.add(symbol)'));
    });

    it('uses "export default" by default (esModule: true)', () => {
      const output = runLoader('star.svg');
      assert.ok(output.includes('export default'));
    });

    it('uses "module.exports" when esModule is false', () => {
      const output = runLoader('star.svg', { esModule: false });
      assert.ok(output.includes('module.exports ='));
      assert.ok(!output.includes('export default'));
    });
  });

  describe('extract mode', () => {
    it('does NOT include browser-sprite runtime', () => {
      const output = runLoader('star.svg', { extract: true });
      assert.ok(!output.includes('browser-sprite'));
    });

    it('generates a URL pointing to the sprite file with fragment', () => {
      const output = runLoader('star.svg', {
        extract: true,
        spriteFilename: 'icons.svg',
        publicPath: '/assets/',
      });
      assert.ok(output.includes('/assets/icons.svg#star'));
    });

    it('registers the symbol with the plugin via _compilation', () => {
      const fullPath = path.resolve(FIXTURES, 'star.svg');
      const content = fs.readFileSync(fullPath, 'utf-8');
      const pluginMock = {
        symbols: [],
        addSymbol(data) { this.symbols.push(data); },
      };
      const ctx = createMockLoaderContext(fullPath, { extract: true });
      ctx._compilation[loader.NAMESPACE] = pluginMock;

      loader.call(ctx, content);

      assert.equal(pluginMock.symbols.length, 1);
      assert.equal(pluginMock.symbols[0].id, 'star');
      assert.ok(pluginMock.symbols[0].content.includes('<symbol'));
    });
  });

  describe('error handling', () => {
    it('throws when content has no <svg tag', () => {
      const ctx = createMockLoaderContext('/fake/not-svg.svg');
      assert.throws(
        () => loader.call(ctx, '<div>not an svg</div>'),
        /Invalid SVG content/
      );
    });
  });
});
