import { describe, it, expect } from '@rstest/core';
import SvgSpritePlugin, { FallbackRawSource, resolveRawSource } from '../plugin';

interface MockSource {
  _content: string;
  source(): string;
  size(): number;
  buffer(): Buffer;
  map(): null;
  sourceAndMap(): { source: string; map: null };
}

function createMockCompiler() {
  const compiler = {
    rspack: {
      Compilation: { PROCESS_ASSETS_STAGE_ADDITIONAL: -2000 },
      sources: {
        RawSource: class RawSource implements MockSource {
          _content: string;
          constructor(content: string) {
            this._content = content;
          }
          source() {
            return this._content;
          }
          size() {
            return this._content.length;
          }
          buffer() {
            return Buffer.from(this._content);
          }
          map() {
            return null;
          }
          sourceAndMap() {
            return { source: this._content, map: null as null };
          }
        },
      },
    },
    hooks: {
      thisCompilation: {
        tap(_name: string, fn: (compilation: any) => void) {
          compiler._thisCompilationFn = fn;
        },
      },
    },
    _thisCompilationFn: null as ((compilation: any) => void) | null,
  };

  function runCompilation() {
    const processAssetsTaps: Array<(assets: Record<string, MockSource>) => void> = [];
    const emittedAssets: Record<string, MockSource> = {};
    const compilation = {
      emitAsset(name: string, source: MockSource) {
        emittedAssets[name] = source;
      },
      hooks: {
        processAssets: {
          tap(_opts: any, fn: (assets: Record<string, MockSource>) => void) {
            processAssetsTaps.push(fn);
          },
        },
      },
    };

    if (compiler._thisCompilationFn) {
      compiler._thisCompilationFn(compilation);
    }

    return {
      compilation,
      emittedAssets,
      runProcessAssets() {
        processAssetsTaps.forEach((fn) => fn(emittedAssets));
      },
    };
  }

  return { compiler, runCompilation };
}

function createMockWebpackCompiler() {
  const compiler = {
    hooks: {
      thisCompilation: {
        tap(_name: string, fn: (compilation: any) => void) {
          compiler._thisCompilationFn = fn;
        },
      },
    },
    _thisCompilationFn: null as ((compilation: any) => void) | null,
  };

  function runCompilation() {
    const processAssetsTaps: Array<(assets: Record<string, MockSource>) => void> = [];
    const emittedAssets: Record<string, MockSource> = {};
    const compilation = {
      emitAsset(name: string, source: MockSource) {
        emittedAssets[name] = source;
      },
      hooks: {
        processAssets: {
          tap(_opts: any, fn: (assets: Record<string, MockSource>) => void) {
            processAssetsTaps.push(fn);
          },
        },
      },
    };

    if (compiler._thisCompilationFn) {
      compiler._thisCompilationFn(compilation);
    }

    return {
      compilation,
      emittedAssets,
      runProcessAssets() {
        processAssetsTaps.forEach((fn) => fn(emittedAssets));
      },
    };
  }

  return { compiler, runCompilation };
}

describe('SvgSpritePlugin', () => {
  it('can be instantiated with default config', () => {
    const plugin = new SvgSpritePlugin();
    expect(plugin.config.plainSprite).toBe(false);
    expect(plugin.config.spriteAttrs).toEqual({});
  });

  it('accepts custom spriteAttrs', () => {
    const plugin = new SvgSpritePlugin({ spriteAttrs: { id: 'my-sprite' } });
    expect(plugin.config.spriteAttrs.id).toBe('my-sprite');
  });

  it('accepts plainSprite option', () => {
    const plugin = new SvgSpritePlugin({ plainSprite: true });
    expect(plugin.config.plainSprite).toBe(true);
  });

  it('generates plain sprite without styles and use elements when plainSprite is true', () => {
    const plugin = new SvgSpritePlugin({ plainSprite: true });
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const { emittedAssets, runProcessAssets } = runCompilation();
    plugin.addSymbol({ id: 'a', content: '<symbol id="a"/>', spriteFilename: 'sprite.svg' });
    runProcessAssets();

    const output = emittedAssets['sprite.svg'].source();
    expect(output).toContain('<symbol id="a"/>');
    expect(output).not.toContain('<style>');
    expect(output).not.toContain('<use');
    expect(output).toContain('<defs>');
    expect(output).toContain('xmlns:xlink');
  });

  it('generates full sprite with styles and use elements when plainSprite is false', () => {
    const plugin = new SvgSpritePlugin({ plainSprite: false });
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const { emittedAssets, runProcessAssets } = runCompilation();
    plugin.addSymbol({ id: 'b', content: '<symbol id="b"/>', spriteFilename: 'sprite.svg' });
    runProcessAssets();

    const output = emittedAssets['sprite.svg'].source();
    expect(output).toContain('<style>');
    expect(output).toContain('<use');
    expect(output).toContain('<defs>');
  });

  it('merges only provided config keys', () => {
    const plugin = new SvgSpritePlugin({ plainSprite: true });
    expect(plugin.config.spriteAttrs).toEqual({});
  });

  it('exposes the NAMESPACE constant', () => {
    const plugin = new SvgSpritePlugin();
    expect(plugin.NAMESPACE).toBe('rspack-plugin-svg-sprite');
  });

  it('registers itself on compilation[NAMESPACE] during thisCompilation', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const { compilation } = runCompilation();
    expect((compilation as any)['rspack-plugin-svg-sprite']).toBe(plugin);
  });

  it('collects symbols via addSymbol()', () => {
    const plugin = new SvgSpritePlugin();
    plugin.addSymbol({ id: 'a', viewBox: '0 0 1 1', content: '<symbol id="a"/>' });
    plugin.addSymbol({ id: 'b', viewBox: '0 0 2 2', content: '<symbol id="b"/>' });
    expect(plugin.symbols.length).toBe(2);
  });

  it('deduplicates symbols with the same id', () => {
    const plugin = new SvgSpritePlugin();
    plugin.addSymbol({ id: 'dup', viewBox: '0 0 1 1', content: '<symbol id="dup">v1</symbol>' });
    plugin.addSymbol({ id: 'dup', viewBox: '0 0 1 1', content: '<symbol id="dup">v2</symbol>' });
    expect(plugin.symbols.length).toBe(1);
    expect(plugin.symbols[0].content).toContain('v2');
  });

  it('warns when duplicate symbol IDs come from different files', () => {
    const plugin = new SvgSpritePlugin();
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => warnings.push(args.join(' '));

    plugin.addSymbol({
      id: 'close',
      content: '<symbol id="close"/>',
      resourcePath: '/icons/close.svg',
    });
    plugin.addSymbol({
      id: 'close',
      content: '<symbol id="close"/>',
      resourcePath: '/nav/close.svg',
    });

    console.warn = originalWarn;

    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('Duplicate symbol ID "close"');
    expect(warnings[0]).toContain('/icons/close.svg');
    expect(warnings[0]).toContain('/nav/close.svg');
    expect(warnings[0]).toContain('[folder]-[name]');
  });

  it('does not warn when the same file re-registers its symbol (HMR)', () => {
    const plugin = new SvgSpritePlugin();
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => warnings.push(args.join(' '));

    plugin.addSymbol({
      id: 'icon',
      content: '<symbol id="icon">v1</symbol>',
      resourcePath: '/icons/icon.svg',
    });
    plugin.addSymbol({
      id: 'icon',
      content: '<symbol id="icon">v2</symbol>',
      resourcePath: '/icons/icon.svg',
    });

    console.warn = originalWarn;

    expect(warnings.length).toBe(0);
    expect(plugin.symbols[0].content).toContain('v2');
  });

  it('emits a sprite.svg asset during processAssets', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const { emittedAssets, runProcessAssets } = runCompilation();

    plugin.addSymbol({
      id: 'icon-star',
      viewBox: '0 0 32 32',
      content: '<symbol id="icon-star" viewBox="0 0 32 32"><polygon/></symbol>',
      spriteFilename: 'sprite.svg',
    });

    runProcessAssets();

    expect(emittedAssets).toHaveProperty('sprite.svg');
    const spriteContent = emittedAssets['sprite.svg'].source();
    expect(spriteContent).toContain('<svg');
    expect(spriteContent).toContain('icon-star');
    expect(spriteContent).toContain('<polygon');
    expect(spriteContent).toContain('</svg>');
  });

  it('groups symbols into separate sprite files by spriteFilename', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const { emittedAssets, runProcessAssets } = runCompilation();

    plugin.addSymbol({ id: 'a', content: '<symbol id="a"/>', spriteFilename: 'icons.svg' });
    plugin.addSymbol({ id: 'b', content: '<symbol id="b"/>', spriteFilename: 'logos.svg' });

    runProcessAssets();

    expect(emittedAssets).toHaveProperty('icons.svg');
    expect(emittedAssets).toHaveProperty('logos.svg');
    expect(emittedAssets['icons.svg'].source()).toContain('id="a"');
    expect(emittedAssets['logos.svg'].source()).toContain('id="b"');
  });

  it('includes custom spriteAttrs in the generated SVG', () => {
    const plugin = new SvgSpritePlugin({
      spriteAttrs: { id: 'my-sprite', class: 'hidden' },
    });
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const { emittedAssets, runProcessAssets } = runCompilation();

    plugin.addSymbol({ id: 'x', content: '<symbol id="x"/>', spriteFilename: 'sprite.svg' });

    runProcessAssets();

    const output = emittedAssets['sprite.svg'].source();
    expect(output).toContain('id="my-sprite"');
    expect(output).toContain('class="hidden"');
  });

  it('clears symbols between compilations so deleted SVGs do not persist', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const first = runCompilation();
    plugin.addSymbol({
      id: 'icon-a',
      content: '<symbol id="icon-a"/>',
      spriteFilename: 'sprite.svg',
    });
    first.runProcessAssets();
    expect(first.emittedAssets).toHaveProperty('sprite.svg');
    expect(first.emittedAssets['sprite.svg'].source()).toContain('icon-a');

    // Second compilation without re-adding symbols — should have empty symbols
    const originalWarn = console.warn;
    console.warn = () => {};
    const second = runCompilation();
    second.runProcessAssets();
    console.warn = originalWarn;
    expect(Object.keys(second.emittedAssets).length).toBe(0);
  });

  it('does not emit anything when no symbols are registered', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const originalWarn = console.warn;
    console.warn = () => {};
    const { emittedAssets, runProcessAssets } = runCompilation();
    runProcessAssets();
    console.warn = originalWarn;

    expect(Object.keys(emittedAssets).length).toBe(0);
  });

  it('warns when no symbols are collected during processAssets', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      warnings.push(args.join(' '));
    };

    const { runProcessAssets } = runCompilation();
    runProcessAssets();

    console.warn = originalWarn;

    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('no SVG symbols were collected');
    expect(warnings[0]).toContain('type: "javascript/auto"');
  });

  it('falls back to inline RawSource when webpack-sources is unavailable', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockWebpackCompiler();
    plugin.apply(compiler as any);

    const { emittedAssets, runProcessAssets } = runCompilation();

    plugin.addSymbol({
      id: 'fb',
      content: '<symbol id="fb"/>',
      spriteFilename: 'sprite.svg',
    });

    runProcessAssets();

    expect(emittedAssets).toHaveProperty('sprite.svg');
    const src = emittedAssets['sprite.svg'];
    expect(src.source()).toContain('<svg');
    expect(src.size()).toBeGreaterThan(0);
    expect(src.buffer()).toBeInstanceOf(Buffer);
    expect(src.map()).toBeNull();
    expect(src.sourceAndMap()).toEqual({ source: src.source(), map: null });
  });

  it('groups multiple symbols with the same spriteFilename into one sprite', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const { emittedAssets, runProcessAssets } = runCompilation();

    plugin.addSymbol({ id: 'a', content: '<symbol id="a"/>', spriteFilename: 'shared.svg' });
    plugin.addSymbol({ id: 'b', content: '<symbol id="b"/>', spriteFilename: 'shared.svg' });

    runProcessAssets();

    expect(emittedAssets).toHaveProperty('shared.svg');
    const output = emittedAssets['shared.svg'].source();
    expect(output).toContain('id="a"');
    expect(output).toContain('id="b"');
  });

  it('uses default sprite.svg filename when spriteFilename is omitted', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const { emittedAssets, runProcessAssets } = runCompilation();

    plugin.addSymbol({ id: 'nofile', content: '<symbol id="nofile"/>' });

    runProcessAssets();

    expect(emittedAssets).toHaveProperty('sprite.svg');
  });
});

describe('sprite structural integrity', () => {
  it('plain mode sprite is well-formed SVG with required namespaces and defs wrapper', () => {
    const plugin = new SvgSpritePlugin({ plainSprite: true });
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const { emittedAssets, runProcessAssets } = runCompilation();
    plugin.addSymbol({
      id: 'icon-a',
      content: '<symbol id="icon-a" viewBox="0 0 16 16"><path d="M0 0"/></symbol>',
      spriteFilename: 'sprite.svg',
    });
    plugin.addSymbol({
      id: 'icon-b',
      content: '<symbol id="icon-b" viewBox="0 0 24 24"><circle r="10"/></symbol>',
      spriteFilename: 'sprite.svg',
    });
    runProcessAssets();

    const output = emittedAssets['sprite.svg'].source();

    // Must start with <svg and end with </svg>
    expect(output).toMatch(/^<svg\s/);
    expect(output).toMatch(/<\/svg>$/);

    // Required namespace declarations for external <use xlink:href="sprite.svg#id"> references
    expect(output).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(output).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');

    // Symbols must be wrapped in <defs>
    expect(output).toContain('<defs>');
    expect(output).toContain('</defs>');

    // Verify <defs> wraps all symbols (symbols appear between <defs> and </defs>)
    const defsStart = output.indexOf('<defs>');
    const defsEnd = output.indexOf('</defs>');
    const symbolAPos = output.indexOf('<symbol id="icon-a"');
    const symbolBPos = output.indexOf('<symbol id="icon-b"');
    expect(symbolAPos).toBeGreaterThan(defsStart);
    expect(symbolAPos).toBeLessThan(defsEnd);
    expect(symbolBPos).toBeGreaterThan(defsStart);
    expect(symbolBPos).toBeLessThan(defsEnd);

    // Plain mode must NOT have <style> or <use> elements
    expect(output).not.toContain('<style>');
    expect(output).not.toContain('<use');
  });

  it('full mode sprite is well-formed SVG with required namespaces, defs, styles, and use elements', () => {
    const plugin = new SvgSpritePlugin({ plainSprite: false });
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const { emittedAssets, runProcessAssets } = runCompilation();
    plugin.addSymbol({
      id: 'icon-a',
      content: '<symbol id="icon-a" viewBox="0 0 16 16"><path d="M0 0"/></symbol>',
      spriteFilename: 'sprite.svg',
    });
    plugin.addSymbol({
      id: 'icon-b',
      content: '<symbol id="icon-b" viewBox="0 0 24 24"><circle r="10"/></symbol>',
      spriteFilename: 'sprite.svg',
    });
    runProcessAssets();

    const output = emittedAssets['sprite.svg'].source();

    // Must start with <svg and end with </svg>
    expect(output).toMatch(/^<svg\s/);
    expect(output).toMatch(/<\/svg>$/);

    // Required namespace declarations
    expect(output).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(output).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');

    // Must have <defs> wrapper
    expect(output).toContain('<defs>');
    expect(output).toContain('</defs>');

    // Must have <style> with :target rules for fragment identifier usage
    expect(output).toContain('<style>');
    expect(output).toContain('.sprite-symbol-usage');
    expect(output).toContain(':target');

    // Must have <use> elements with href references for each symbol
    expect(output).toContain('<use id="icon-a-usage" href="#icon-a"');
    expect(output).toContain('<use id="icon-b-usage" href="#icon-b"');
    expect(output).toContain('class="sprite-symbol-usage"');
  });

  it('both modes produce identical namespace declarations', () => {
    const plainPlugin = new SvgSpritePlugin({ plainSprite: true });
    const fullPlugin = new SvgSpritePlugin({ plainSprite: false });
    const symbol = {
      id: 'test',
      content: '<symbol id="test" viewBox="0 0 10 10"><rect/></symbol>',
      spriteFilename: 'sprite.svg',
    };

    const { compiler: c1, runCompilation: rc1 } = createMockCompiler();
    plainPlugin.apply(c1 as any);
    const r1 = rc1();
    plainPlugin.addSymbol(symbol);
    r1.runProcessAssets();

    const { compiler: c2, runCompilation: rc2 } = createMockCompiler();
    fullPlugin.apply(c2 as any);
    const r2 = rc2();
    fullPlugin.addSymbol(symbol);
    r2.runProcessAssets();

    const plainOutput = r1.emittedAssets['sprite.svg'].source();
    const fullOutput = r2.emittedAssets['sprite.svg'].source();

    // Extract the <svg ...> opening tag from both
    const plainSvgTag = plainOutput.match(/<svg[^>]*>/)?.[0];
    const fullSvgTag = fullOutput.match(/<svg[^>]*>/)?.[0];
    expect(plainSvgTag).toBe(fullSvgTag);
  });

  it('sprite with custom spriteAttrs still includes required namespaces', () => {
    const plugin = new SvgSpritePlugin({
      plainSprite: true,
      spriteAttrs: { id: 'custom', 'aria-hidden': 'true' },
    });
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const { emittedAssets, runProcessAssets } = runCompilation();
    plugin.addSymbol({ id: 'x', content: '<symbol id="x"/>', spriteFilename: 'sprite.svg' });
    runProcessAssets();

    const output = emittedAssets['sprite.svg'].source();
    expect(output).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(output).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    expect(output).toContain('id="custom"');
    expect(output).toContain('aria-hidden="true"');
    expect(output).toContain('<defs>');
  });
});

describe('FallbackRawSource', () => {
  it('returns source content via source()', () => {
    const src = new (FallbackRawSource as any)('hello');
    expect(src.source()).toBe('hello');
  });

  it('returns byte length via size()', () => {
    const src = new (FallbackRawSource as any)('test');
    expect(src.size()).toBe(4);
  });

  it('returns correct byte length for multi-byte characters', () => {
    const src = new (FallbackRawSource as any)('\u00e9'); // é = 2 bytes in UTF-8
    expect(src.size()).toBe(2);
  });

  it('returns a Buffer via buffer()', () => {
    const src = new (FallbackRawSource as any)('buf');
    expect(src.buffer()).toBeInstanceOf(Buffer);
    expect(src.buffer().toString()).toBe('buf');
  });

  it('returns null from map()', () => {
    const src = new (FallbackRawSource as any)('x');
    expect(src.map()).toBeNull();
  });

  it('returns source and null map from sourceAndMap()', () => {
    const src = new (FallbackRawSource as any)('content');
    expect(src.sourceAndMap()).toEqual({ source: 'content', map: null });
  });
});

describe('resolveRawSource', () => {
  it('returns rspack RawSource when compiler.rspack.sources is available', () => {
    const MockRawSource = class {};
    const compiler = { rspack: { sources: { RawSource: MockRawSource } } };
    expect(resolveRawSource(compiler)).toBe(MockRawSource);
  });

  it('returns webpack-sources RawSource when available via requireFn', () => {
    const WpRawSource = class {};
    const fakeRequire = () => ({ RawSource: WpRawSource });
    expect(resolveRawSource({}, fakeRequire)).toBe(WpRawSource);
  });

  it('falls back to FallbackRawSource when requireFn throws', () => {
    const failingRequire = () => {
      throw new Error('not found');
    };
    const RawSource = resolveRawSource({}, failingRequire);
    expect(RawSource).toBe(FallbackRawSource);
    const instance = new RawSource('test');
    expect(instance.source()).toBe('test');
  });
});
