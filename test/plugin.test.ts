import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import SvgSpritePlugin from '../dist/index';

interface MockSource {
  _content: string;
  source(): string;
  size(): number;
  buffer(): Buffer;
  map(): null;
  sourceAndMap(): { source: string; map: null };
}

function createMockCompiler() {
  const processAssetsTaps: Array<(assets: Record<string, MockSource>) => void> = [];
  const afterCompileTaps: Array<(compilation: any) => void> = [];

  const compiler = {
    rspack: {
      Compilation: { PROCESS_ASSETS_STAGE_ADDITIONAL: -2000 },
      sources: {
        RawSource: class RawSource implements MockSource {
          _content: string;
          constructor(content: string) {
            this._content = content;
          }
          source() { return this._content; }
          size() { return this._content.length; }
          buffer() { return Buffer.from(this._content); }
          map() { return null; }
          sourceAndMap() { return { source: this._content, map: null as null }; }
        },
      },
    },
    hooks: {
      thisCompilation: {
        tap(_name: string, fn: (compilation: any) => void) {
          compiler._thisCompilationFn = fn;
        },
      },
      afterCompile: {
        tap(_name: string, fn: (compilation: any) => void) {
          afterCompileTaps.push(fn);
        },
      },
    },
    _thisCompilationFn: null as ((compilation: any) => void) | null,
    _afterCompileTaps: afterCompileTaps,
  };

  function runCompilation() {
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
      runAfterCompile() {
        afterCompileTaps.forEach((fn) => fn(compilation));
      },
    };
  }

  return { compiler, runCompilation };
}

describe('SvgSpritePlugin', () => {
  it('can be instantiated with default config', () => {
    const plugin = new SvgSpritePlugin();
    assert.equal(plugin.config.plainSprite, false);
    assert.deepEqual(plugin.config.spriteAttrs, {});
  });

  it('accepts custom spriteAttrs', () => {
    const plugin = new SvgSpritePlugin({ spriteAttrs: { id: 'my-sprite' } });
    assert.equal(plugin.config.spriteAttrs.id, 'my-sprite');
  });

  it('exposes the NAMESPACE constant', () => {
    const plugin = new SvgSpritePlugin();
    assert.equal(plugin.NAMESPACE, 'rspack-plugin-svg-sprite');
  });

  it('registers itself on compilation[NAMESPACE] during thisCompilation', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const { compilation } = runCompilation();
    assert.strictEqual((compilation as any)['rspack-plugin-svg-sprite'], plugin);
  });

  it('collects symbols via addSymbol()', () => {
    const plugin = new SvgSpritePlugin();
    plugin.addSymbol({ id: 'a', viewBox: '0 0 1 1', content: '<symbol id="a"/>' });
    plugin.addSymbol({ id: 'b', viewBox: '0 0 2 2', content: '<symbol id="b"/>' });
    assert.equal(plugin.symbols.length, 2);
  });

  it('deduplicates symbols with the same id', () => {
    const plugin = new SvgSpritePlugin();
    plugin.addSymbol({ id: 'dup', viewBox: '0 0 1 1', content: '<symbol id="dup">v1</symbol>' });
    plugin.addSymbol({ id: 'dup', viewBox: '0 0 1 1', content: '<symbol id="dup">v2</symbol>' });
    assert.equal(plugin.symbols.length, 1);
    assert.ok(plugin.symbols[0].content.includes('v2'));
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

    assert.ok('sprite.svg' in emittedAssets);
    const spriteContent = emittedAssets['sprite.svg'].source();
    assert.ok(spriteContent.includes('<svg'));
    assert.ok(spriteContent.includes('icon-star'));
    assert.ok(spriteContent.includes('<polygon'));
    assert.ok(spriteContent.includes('</svg>'));
  });

  it('groups symbols into separate sprite files by spriteFilename', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    plugin.addSymbol({ id: 'a', content: '<symbol id="a"/>', spriteFilename: 'icons.svg' });
    plugin.addSymbol({ id: 'b', content: '<symbol id="b"/>', spriteFilename: 'logos.svg' });

    const { emittedAssets, runProcessAssets } = runCompilation();
    runProcessAssets();

    assert.ok('icons.svg' in emittedAssets);
    assert.ok('logos.svg' in emittedAssets);
    assert.ok(emittedAssets['icons.svg'].source().includes('id="a"'));
    assert.ok(emittedAssets['logos.svg'].source().includes('id="b"'));
  });

  it('includes custom spriteAttrs in the generated SVG', () => {
    const plugin = new SvgSpritePlugin({ spriteAttrs: { id: 'my-sprite', class: 'hidden' } });
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    plugin.addSymbol({ id: 'x', content: '<symbol id="x"/>', spriteFilename: 'sprite.svg' });

    const { emittedAssets, runProcessAssets } = runCompilation();
    runProcessAssets();

    const output = emittedAssets['sprite.svg'].source();
    assert.ok(output.includes('id="my-sprite"'));
    assert.ok(output.includes('class="hidden"'));
  });

  it('clears symbols after compilation (afterCompile hook)', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    plugin.addSymbol({ id: 'temp', content: '<symbol/>', spriteFilename: 'sprite.svg' });
    assert.equal(plugin.symbols.length, 1);

    const { runAfterCompile } = runCompilation();
    runAfterCompile();

    assert.equal(plugin.symbols.length, 0);
  });

  it('does not emit anything when no symbols are registered', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler as any);

    const { emittedAssets, runProcessAssets } = runCompilation();
    runProcessAssets();

    assert.equal(Object.keys(emittedAssets).length, 0);
  });
});
