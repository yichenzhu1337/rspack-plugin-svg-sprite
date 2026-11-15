import type { Compiler, Compilation } from '@rspack/core';

const NAMESPACE = 'rspack-plugin-svg-sprite';

interface PluginConfig {
  plainSprite?: boolean;
  spriteAttrs?: Record<string, string>;
}

interface SymbolData {
  id: string;
  viewBox?: string;
  content: string;
  resourcePath?: string;
  spriteFilename?: string;
}

const defaultConfig: Required<PluginConfig> = {
  plainSprite: false,
  spriteAttrs: {},
};

function merge(target: Required<PluginConfig>, source: PluginConfig): Required<PluginConfig> {
  const result = { ...target };
  if (source.plainSprite !== undefined) result.plainSprite = source.plainSprite;
  if (source.spriteAttrs !== undefined) result.spriteAttrs = source.spriteAttrs;
  return result;
}

class SvgSpritePlugin {
  public config: Required<PluginConfig>;
  public symbols: SymbolData[];
  // id -> position in `symbols`, so registering an icon is O(1) instead of a scan per icon.
  // `symbols` is public and may be replaced or edited from outside, so the index remembers
  // which array and length it describes and is rebuilt whenever that no longer matches.
  private symbolIndex = new Map<string, number>();
  private indexedSymbols: SymbolData[] | null = null;
  private indexedCount = 0;

  constructor(cfg?: PluginConfig) {
    this.config = merge(defaultConfig, cfg || {});
    this.symbols = [];
  }

  get NAMESPACE(): string {
    return NAMESPACE;
  }

  private rebuildSymbolIndex(): void {
    this.symbolIndex.clear();
    this.symbols.forEach((s, i) => this.symbolIndex.set(s.id, i));
    this.indexedSymbols = this.symbols;
    this.indexedCount = this.symbols.length;
  }

  private findSymbol(id: string): number {
    if (this.indexedSymbols !== this.symbols || this.indexedCount !== this.symbols.length) {
      this.rebuildSymbolIndex();
    }
    let position = this.symbolIndex.get(id);
    if (position !== undefined && this.symbols[position]!.id !== id) {
      // An entry was swapped in place from outside: the index is stale.
      this.rebuildSymbolIndex();
      position = this.symbolIndex.get(id);
    }
    return position === undefined ? -1 : position;
  }

  addSymbol(symbolData: SymbolData): void {
    const existing = this.findSymbol(symbolData.id);
    if (existing >= 0) {
      const prev = this.symbols[existing]!;
      if (
        prev.resourcePath &&
        symbolData.resourcePath &&
        prev.resourcePath !== symbolData.resourcePath
      ) {
        console.warn(
          '[rspack-plugin-svg-sprite] Duplicate symbol ID "' +
            symbolData.id +
            '" from:\n' +
            '  - ' +
            prev.resourcePath +
            '\n' +
            '  - ' +
            symbolData.resourcePath +
            '\n' +
            'The second file will overwrite the first. Use a symbolId pattern like ' +
            '"[folder]-[name]" to avoid collisions.',
        );
      }
      this.symbols[existing] = symbolData;
    } else {
      this.symbolIndex.set(symbolData.id, this.symbols.length);
      this.symbols.push(symbolData);
      this.indexedCount = this.symbols.length;
    }
  }

  generateSprite(symbols: SymbolData[]): string {
    let attrs = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';

    Object.keys(this.config.spriteAttrs).forEach((key) => {
      attrs += ' ' + key + '="' + this.config.spriteAttrs[key] + '"';
    });

    const symbolsContent = symbols.map((s) => s.content).join('\n');

    if (this.config.plainSprite) {
      return '<svg ' + attrs + '>\n<defs>\n' + symbolsContent + '\n</defs>\n</svg>';
    }

    const styles =
      '<style>\n' +
      '    .sprite-symbol-usage {display: none;}\n' +
      '    .sprite-symbol-usage:target {display: inline;}\n' +
      '  </style>';

    const usages = symbols
      .map(
        (s) =>
          '<use id="' +
          s.id +
          '-usage" href="#' +
          s.id +
          '" width="100%" height="100%" class="sprite-symbol-usage" />',
      )
      .join('\n');

    return (
      '<svg ' +
      attrs +
      '>\n<defs>\n' +
      styles +
      '\n' +
      symbolsContent +
      '\n</defs>\n' +
      usages +
      '\n</svg>'
    );
  }

  apply = (compiler: Compiler): void => {
    compiler.hooks.thisCompilation.tap(NAMESPACE, (compilation: Compilation) => {
      this.symbols = [];
      (compilation as any)[NAMESPACE] = this;

      compilation.hooks.processAssets.tap(
        {
          name: NAMESPACE,
          stage: (compiler as any).rspack
            ? (compiler as any).rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
            : 0,
        },
        () => {
          if (this.symbols.length === 0) {
            console.warn(
              '[rspack-plugin-svg-sprite] SvgSpritePlugin is registered but no SVG symbols were' +
                ' collected during compilation.\n' +
                'Ensure your SVG loader rule includes `type: "javascript/auto"` to prevent' +
                " rspack/webpack's built-in asset modules from intercepting .svg files.\n" +
                'Example:\n' +
                '  {\n' +
                '    test: /\\.svg$/,\n' +
                '    type: "javascript/auto",\n' +
                "    loader: 'rspack-plugin-svg-sprite/loader',\n" +
                '    options: { extract: true },\n' +
                '  }',
            );
            return;
          }

          const symbolsByFile: Record<string, SymbolData[]> = {};
          this.symbols.forEach((sym) => {
            const filename = sym.spriteFilename || 'sprite.svg';
            if (!symbolsByFile[filename]) symbolsByFile[filename] = [];
            symbolsByFile[filename].push(sym);
          });

          Object.keys(symbolsByFile).forEach((filename) => {
            // Loaders finish in a different order on every build. Sort so identical input
            // always produces an identical sprite file.
            const ordered = (symbolsByFile[filename] as SymbolData[])
              .slice()
              .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
            const content = this.generateSprite(ordered);
            const RawSource = resolveRawSource(compiler);
            compilation.emitAsset(filename, new RawSource(content));
          });
        },
      );
    });
  };
}

export function FallbackRawSource(this: any, str: string) {
  this._value = str;
  this.source = () => str;
  this.size = () => Buffer.byteLength(str, 'utf8');
  this.buffer = () => Buffer.from(str);
  this.map = () => null;
  this.sourceAndMap = () => ({ source: str, map: null });
}

export function resolveRawSource(compiler: any, requireFn: (id: string) => any = require): any {
  if (compiler.rspack && compiler.rspack.sources) {
    return compiler.rspack.sources.RawSource;
  }
  try {
    return requireFn('webpack-sources').RawSource;
  } catch {
    return FallbackRawSource;
  }
}

export default SvgSpritePlugin;
