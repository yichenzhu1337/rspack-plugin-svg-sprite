const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const SvgSpritePlugin = require('../plugin');

function createMockCompiler() {
  const processAssetsTaps = [];
  const afterCompileTaps = [];

  const compiler = {
    rspack: {
      Compilation: { PROCESS_ASSETS_STAGE_ADDITIONAL: -2000 },
      sources: {
        RawSource: class RawSource {
          constructor(content) {
            this._content = content;
          }
          source() { return this._content; }
          size() { return this._content.length; }
          buffer() { return Buffer.from(this._content); }
          map() { return null; }
          sourceAndMap() { return { source: this._content, map: null }; }
        },
      },
    },
    hooks: {
      thisCompilation: {
        tap(name, fn) {
          compiler._thisCompilationFn = fn;
        },
      },
      afterCompile: {
        tap(name, fn) {
          afterCompileTaps.push(fn);
        },
      },
    },
    _thisCompilationFn: null,
    _afterCompileTaps: afterCompileTaps,
  };

  function runCompilation() {
    const emittedAssets = {};
    const compilation = {
      emitAsset(name, source) {
        emittedAssets[name] = source;
      },
      hooks: {
        processAssets: {
          tap(opts, fn) {
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
    plugin.apply(compiler);

    const { compilation } = runCompilation();
    assert.strictEqual(compilation['rspack-plugin-svg-sprite'], plugin);
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
    plugin.apply(compiler);

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
    plugin.apply(compiler);

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
    plugin.apply(compiler);

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
    plugin.apply(compiler);

    plugin.addSymbol({ id: 'temp', content: '<symbol/>', spriteFilename: 'sprite.svg' });
    assert.equal(plugin.symbols.length, 1);

    const { runAfterCompile } = runCompilation();
    runAfterCompile();

    assert.equal(plugin.symbols.length, 0);
  });

  it('does not emit anything when no symbols are registered', () => {
    const plugin = new SvgSpritePlugin();
    const { compiler, runCompilation } = createMockCompiler();
    plugin.apply(compiler);

    const { emittedAssets, runProcessAssets } = runCompilation();
    runProcessAssets();

    assert.equal(Object.keys(emittedAssets).length, 0);
  });
});
