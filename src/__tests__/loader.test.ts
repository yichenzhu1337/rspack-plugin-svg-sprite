import { describe, it, expect } from '@rstest/core';
import path from 'path';
import fs from 'fs';
import loader from 'rspack-plugin-svg-sprite/loader';

const FIXTURES = path.resolve(process.cwd(), 'src/__tests__/fixtures');

interface MockLoaderContext {
  resourcePath: string;
  cacheable(): void;
  getOptions(): Record<string, unknown>;
  _compiler: { context: string };
  _compilation: Record<string, unknown>;
}

function createMockLoaderContext(
  resourcePath: string,
  options: Record<string, unknown> = {},
): MockLoaderContext {
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

function runLoader(svgPath: string, options: Record<string, unknown> = {}): string {
  const fullPath = path.resolve(FIXTURES, svgPath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const ctx = createMockLoaderContext(fullPath, options);
  return loader.call(ctx as any, content);
}

describe('Loader', () => {
  describe('SVG parsing', () => {
    it('generates a <symbol> wrapping the SVG inner content', () => {
      const output = runLoader('arrow.svg');
      expect(output).toContain('<symbol');
      expect(output).toContain('</symbol>');
      expect(output).toContain('<path');
    });

    it('extracts the viewBox from the source SVG', () => {
      const output = runLoader('arrow.svg');
      expect(output).toContain('0 0 24 24');
    });

    it('preserves stroke/fill attributes from the original SVG', () => {
      const output = runLoader('arrow.svg');
      expect(output).toContain('stroke=\\"currentColor\\"');
      expect(output).toContain('stroke-width=\\"2\\"');
    });

    it('strips width/height from the generated symbol', () => {
      const output = runLoader('arrow.svg');
      expect(output).not.toContain('width="24"');
      expect(output).not.toContain('height="24"');
    });
  });

  describe('symbolId generation', () => {
    it('defaults to [name] pattern (filename without extension)', () => {
      const output = runLoader('star.svg');
      expect(output).toMatch(/id["\\":]+star/);
    });

    it('supports custom string patterns like "icon-[name]"', () => {
      const output = runLoader('star.svg', { symbolId: 'icon-[name]' });
      expect(output).toContain('icon-star');
    });

    it('supports [folder] placeholder', () => {
      const output = runLoader('circle.svg', { symbolId: '[folder]-[name]' });
      expect(output).toContain('fixtures-circle');
    });

    it('supports a function for symbolId', () => {
      const output = runLoader('arrow.svg', {
        symbolId: (filePath: string) => 'custom-' + path.basename(filePath, '.svg'),
      });
      expect(output).toContain('custom-arrow');
    });
  });

  describe('inline mode (default)', () => {
    it('generates require() calls for SpriteSymbol and browser-sprite', () => {
      const output = runLoader('star.svg');
      expect(output).toContain('require(');
      expect(output).toContain('symbol.js');
      expect(output).toContain('browser-sprite.js');
    });

    it('calls sprite.add(symbol) to register the symbol', () => {
      const output = runLoader('star.svg');
      expect(output).toContain('sprite.add(symbol)');
    });

    it('uses "export default" by default (esModule: true)', () => {
      const output = runLoader('star.svg');
      expect(output).toContain('export default');
    });

    it('uses "module.exports" when esModule is false', () => {
      const output = runLoader('star.svg', { esModule: false });
      expect(output).toContain('module.exports =');
      expect(output).not.toContain('export default');
    });
  });

  describe('extract mode', () => {
    it('does NOT include browser-sprite runtime', () => {
      const output = runLoader('star.svg', { extract: true });
      expect(output).not.toContain('browser-sprite');
    });

    it('generates a URL pointing to the sprite file with fragment', () => {
      const output = runLoader('star.svg', {
        extract: true,
        spriteFilename: 'icons.svg',
        publicPath: '/assets/',
      });
      expect(output).toContain('/assets/icons.svg#star');
    });

    it('registers the symbol with the plugin via _compilation', () => {
      const fullPath = path.resolve(FIXTURES, 'star.svg');
      const content = fs.readFileSync(fullPath, 'utf-8');
      const pluginMock = {
        symbols: [] as Array<{ id: string; content: string }>,
        addSymbol(data: { id: string; content: string }) {
          this.symbols.push(data);
        },
      };
      const ctx = createMockLoaderContext(fullPath, { extract: true });
      ctx._compilation[loader.NAMESPACE] = pluginMock;

      loader.call(ctx as any, content);

      expect(pluginMock.symbols.length).toBe(1);
      expect(pluginMock.symbols[0].id).toBe('star');
      expect(pluginMock.symbols[0].content).toContain('<symbol');
    });
  });

  describe('error handling', () => {
    it('throws when content has no <svg tag', () => {
      const ctx = createMockLoaderContext('/fake/not-svg.svg');
      expect(() => loader.call(ctx as any, '<div>not an svg</div>')).toThrow(/Invalid SVG content/);
    });
  });
});
