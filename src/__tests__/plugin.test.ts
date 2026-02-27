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

  it('emits a sprite.svg asset during processAssets', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    plugin.addSymbol({
      id: 'icon-star',
      viewBox: '0 0 32 32',
      content: '<symbol id="icon-star" viewBox="0 0 32 32"><polygon/></symbol>',
      spriteFilename: 'sprite.svg',
    });

    const { emittedAssets, runProcessAssets } = runCompilation();
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

    plugin.addSymbol({ id: 'a', content: '<symbol id="a"/>', spriteFilename: 'icons.svg' });
    plugin.addSymbol({ id: 'b', content: '<symbol id="b"/>', spriteFilename: 'logos.svg' });

    const { emittedAssets, runProcessAssets } = runCompilation();
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

    plugin.addSymbol({ id: 'x', content: '<symbol id="x"/>', spriteFilename: 'sprite.svg' });

    const { emittedAssets, runProcessAssets } = runCompilation();
    runProcessAssets();

    const output = emittedAssets['sprite.svg'].source();
    expect(output).toContain('id="my-sprite"');
    expect(output).toContain('class="hidden"');
  });

  it('persists symbols across compilations for HMR compatibility', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    plugin.addSymbol({
      id: 'icon-a',
      content: '<symbol id="icon-a"/>',
      spriteFilename: 'sprite.svg',
    });

    const first = runCompilation();
    first.runProcessAssets();
    expect(first.emittedAssets).toHaveProperty('sprite.svg');
    expect(first.emittedAssets['sprite.svg'].source()).toContain('icon-a');

    const second = runCompilation();
    second.runProcessAssets();
    expect(second.emittedAssets).toHaveProperty('sprite.svg');
    expect(second.emittedAssets['sprite.svg'].source()).toContain('icon-a');
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

    plugin.addSymbol({
      id: 'fb',
      content: '<symbol id="fb"/>',
      spriteFilename: 'sprite.svg',
    });

    const { emittedAssets, runProcessAssets } = runCompilation();
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

    plugin.addSymbol({ id: 'a', content: '<symbol id="a"/>', spriteFilename: 'shared.svg' });
    plugin.addSymbol({ id: 'b', content: '<symbol id="b"/>', spriteFilename: 'shared.svg' });

    const { emittedAssets, runProcessAssets } = runCompilation();
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

    plugin.addSymbol({ id: 'nofile', content: '<symbol id="nofile"/>' });

    const { emittedAssets, runProcessAssets } = runCompilation();
    runProcessAssets();

    expect(emittedAssets).toHaveProperty('sprite.svg');
  });
});

describe('FallbackRawSource', () => {
  it('returns source content via source()', () => {
    const src = new (FallbackRawSource as any)('hello');
    expect(src.source()).toBe('hello');
  });

  it('returns content length via size()', () => {
    const src = new (FallbackRawSource as any)('test');
    expect(src.size()).toBe(4);
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
