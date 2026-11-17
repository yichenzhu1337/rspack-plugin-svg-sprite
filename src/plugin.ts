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

// Escapes an attribute value; valid references such as `&amp;` are kept.
function escapeAttr(value: string): string {
  return value
    .replace(/&(?![A-Za-z_:][\w.:-]*;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

// Ids are plain text, so every `&` is literal.
function escapeId(id: string): string {
  return id
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#9;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;');
}

const SAFE_ATTR_NAME = /^[A-Za-z_:\u00C0-\uFFFF][\w.:\-\u00B7\u00C0-\uFFFF]*$/;

function merge(target: Required<PluginConfig>, source: PluginConfig): Required<PluginConfig> {
  const result = { ...target };
  if (source.plainSprite !== undefined) result.plainSprite = source.plainSprite;
  if (source.spriteAttrs !== undefined) result.spriteAttrs = source.spriteAttrs;
  return result;
}

// Ids only have to be unique inside one sprite document, so the index is keyed by sprite file
// and id. The default file name is the one `processAssets` emits for symbols without one.
function symbolKey(spriteFilename: string | undefined, id: string): string {
  return (spriteFilename || 'sprite.svg') + '\u0000' + id;
}

class SvgSpritePlugin {
  public config: Required<PluginConfig>;
  public symbols: SymbolData[];
  // sprite file + id -> position in `symbols`, so registering an icon is O(1), not a scan.
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
    this.symbols.forEach((s, i) => this.symbolIndex.set(symbolKey(s.spriteFilename, s.id), i));
    this.indexedSymbols = this.symbols;
    this.indexedCount = this.symbols.length;
  }

  private symbolKeyAt(position: number): string {
    const s = this.symbols[position]!;
    return symbolKey(s.spriteFilename, s.id);
  }

  private findSymbol(key: string): number {
    if (this.indexedSymbols !== this.symbols || this.indexedCount !== this.symbols.length) {
      this.rebuildSymbolIndex();
    }
    let position = this.symbolIndex.get(key);
    if (position !== undefined && this.symbolKeyAt(position) !== key) {
      // An entry was swapped in place from outside: the index is stale.
      this.rebuildSymbolIndex();
      position = this.symbolIndex.get(key);
    }
    return position === undefined ? -1 : position;
  }

  addSymbol(symbolData: SymbolData): void {
    const key = symbolKey(symbolData.spriteFilename, symbolData.id);
    const existing = this.findSymbol(key);
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
      this.symbolIndex.set(key, this.symbols.length);
      this.symbols.push(symbolData);
      this.indexedCount = this.symbols.length;
    }
  }

  generateSprite(symbols: SymbolData[]): string {
    let attrs = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';

    Object.keys(this.config.spriteAttrs).forEach((key) => {
      if (!SAFE_ATTR_NAME.test(key)) {
        console.warn(
          '[rspack-plugin-svg-sprite] Ignoring spriteAttrs entry "' +
            key +
            '": it is not a valid attribute name.',
        );
        return;
      }
      attrs += ' ' + key + '="' + escapeAttr(String(this.config.spriteAttrs[key])) + '"';
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
          escapeId(s.id) +
          '-usage" href="#' +
          escapeId(s.id.replace(/%(?=[0-9a-fA-F]{2})/g, '%25')) +
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
  // webpack hashes every asset source when an output name has a content hash or the cache is on.
  this.updateHash = (hash: { update(data: string | Buffer): unknown }) => {
    hash.update('RawSource');
    hash.update(Buffer.from(str));
  };
}

export function resolveRawSource(compiler: any, requireFn: (id: string) => any = require): any {
  if (compiler.rspack && compiler.rspack.sources) {
    return compiler.rspack.sources.RawSource;
  }
  // webpack 5's documented way for a plugin to reach `webpack-sources`. Unlike `require`, it
  // works under pnpm, Yarn PnP and Bun, where this package cannot resolve `webpack-sources`.
  if (compiler.webpack && compiler.webpack.sources) {
    return compiler.webpack.sources.RawSource;
  }
  try {
    return requireFn('webpack-sources').RawSource;
  } catch {
    return FallbackRawSource;
  }
}

export default SvgSpritePlugin;
