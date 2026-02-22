import { describe, it, expect } from '@rstest/core';
import path from 'path';
import fs from 'fs';
import loader, {
  NAMESPACE,
  parseViewBox,
  extractSvgInner,
  extractSvgAttrs,
  generateSymbolId,
} from '../loader';

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

describe('parseViewBox', () => {
  it('extracts viewBox from valid SVG', () => {
    expect(parseViewBox('<svg viewBox="0 0 100 100">')).toBe('0 0 100 100');
  });

  it('handles single-quoted viewBox', () => {
    expect(parseViewBox("<svg viewBox='10 20 30 40'>")).toBe('10 20 30 40');
  });

  it('returns default when no viewBox is present', () => {
    expect(parseViewBox('<svg><rect/></svg>')).toBe('0 0 24 24');
  });

  it('returns default for empty string', () => {
    expect(parseViewBox('')).toBe('0 0 24 24');
  });
});

describe('extractSvgInner', () => {
  it('returns the inner content of an <svg> element', () => {
    expect(extractSvgInner('<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>')).toBe(
      '<path d="M5 12h14"/>',
    );
  });

  it('returns the original content when no <svg> wrapper exists', () => {
    expect(extractSvgInner('<path d="M1 2"/>')).toBe('<path d="M1 2"/>');
  });

  it('returns empty string when SVG is empty inside', () => {
    expect(extractSvgInner('<svg></svg>')).toBe('');
  });
});

describe('extractSvgAttrs', () => {
  it('extracts fill and stroke attributes', () => {
    const attrs = extractSvgAttrs('<svg fill="none" stroke="currentColor">');
    expect(attrs['fill']).toBe('none');
    expect(attrs['stroke']).toBe('currentColor');
  });

  it('filters out xmlns, version, class, and style', () => {
    const attrs = extractSvgAttrs(
      '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" class="icon" style="display:none">',
    );
    expect(attrs['xmlns']).toBeUndefined();
    expect(attrs['version']).toBeUndefined();
    expect(attrs['class']).toBeUndefined();
    expect(attrs['style']).toBeUndefined();
  });

  it('returns empty object when input has no <svg> tag', () => {
    const attrs = extractSvgAttrs('<div>not an svg</div>');
    expect(Object.keys(attrs).length).toBe(0);
  });

  it('returns empty object for an empty string', () => {
    const attrs = extractSvgAttrs('');
    expect(Object.keys(attrs).length).toBe(0);
  });
});

describe('generateSymbolId', () => {
  it('defaults to filename without extension', () => {
    expect(generateSymbolId('/icons/arrow.svg', {})).toBe('arrow');
  });

  it('replaces [name] placeholder', () => {
    expect(generateSymbolId('/icons/star.svg', { symbolId: 'icon-[name]' })).toBe('icon-star');
  });

  it('replaces [folder] placeholder', () => {
    const p = path.join('/icons', 'nav', 'home.svg');
    expect(generateSymbolId(p, { symbolId: '[folder]-[name]' })).toBe('nav-home');
  });

  it('replaces [ext] placeholder', () => {
    expect(generateSymbolId('/icons/logo.svg', { symbolId: '[name].[ext]' })).toBe('logo.svg');
  });

  it('calls function symbolId with resourcePath', () => {
    const fn = (p: string) => 'custom-' + path.basename(p, '.svg');
    expect(generateSymbolId('/icons/arrow.svg', { symbolId: fn })).toBe('custom-arrow');
  });

  it('handles file at root with empty dirname segment', () => {
    const p = path.join(path.sep, 'file.svg');
    const id = generateSymbolId(p, { symbolId: '[folder]-[name]' });
    expect(id).toBe('-file');
  });
});

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
      expect(output).toContain('stroke');
      expect(output).toContain('currentColor');
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
      expect(output).toContain('"star"');
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
      expect(output).toContain('SpriteSymbol');
      expect(output).toContain('sprite');
    });

    it('uses interop pattern with .default fallback', () => {
      const output = runLoader('star.svg');
      expect(output).toContain('.default || _');
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

    it('sets symbol.url to the external sprite URL', () => {
      const output = runLoader('star.svg', { extract: true });
      expect(output).toContain('symbol.url');
    });

    it('uses "module.exports" in extract mode when esModule is false', () => {
      const output = runLoader('star.svg', { extract: true, esModule: false });
      expect(output).toContain('module.exports =');
      expect(output).not.toContain('export default');
    });

    it('uses default spriteFilename and publicPath when not specified', () => {
      const output = runLoader('star.svg', { extract: true });
      expect(output).toContain('sprite.svg#star');
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
      ctx._compilation[NAMESPACE] = pluginMock;

      loader.call(ctx as any, content);

      expect(pluginMock.symbols.length).toBe(1);
      expect(pluginMock.symbols[0].id).toBe('star');
      expect(pluginMock.symbols[0].content).toContain('<symbol');
    });

    it('warns when _compilation has no plugin reference', () => {
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        warnings.push(args.join(' '));
      };

      const output = runLoader('star.svg', { extract: true });

      console.warn = originalWarn;

      expect(output).toContain('SpriteSymbol');
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain('SvgSpritePlugin was not found');
      expect(warnings[0]).toContain('new SvgSpritePlugin()');
    });
  });

  describe('error handling', () => {
    it('throws when content has no <svg tag', () => {
      const ctx = createMockLoaderContext('/fake/not-svg.svg');
      expect(() => loader.call(ctx as any, '<div>not an svg</div>')).toThrow(/Invalid SVG content/);
    });
  });

  describe('loader properties', () => {
    it('exposes NAMESPACE constant', () => {
      expect(loader.NAMESPACE).toBe('rspack-plugin-svg-sprite');
    });

    it('NAMESPACE export matches loader.NAMESPACE', () => {
      expect(NAMESPACE).toBe(loader.NAMESPACE);
    });

    it('calls cacheable() when available', () => {
      let cacheableCalled = false;
      const ctx = {
        resourcePath: path.resolve(FIXTURES, 'star.svg'),
        cacheable() {
          cacheableCalled = true;
        },
        getOptions() {
          return {};
        },
        _compilation: {},
      };
      const content = fs.readFileSync(ctx.resourcePath, 'utf-8');
      loader.call(ctx as any, content);
      expect(cacheableCalled).toBe(true);
    });

    it('works without getOptions (empty options)', () => {
      const ctx = {
        resourcePath: path.resolve(FIXTURES, 'star.svg'),
        _compilation: {},
      };
      const content = fs.readFileSync(ctx.resourcePath, 'utf-8');
      const output = loader.call(ctx as any, content);
      expect(output).toContain('star');
    });

    it('works without cacheable function', () => {
      const ctx = {
        resourcePath: path.resolve(FIXTURES, 'star.svg'),
        getOptions() {
          return {};
        },
        _compilation: {},
      };
      const content = fs.readFileSync(ctx.resourcePath, 'utf-8');
      const output = loader.call(ctx as any, content);
      expect(output).toContain('star');
    });
  });
});
