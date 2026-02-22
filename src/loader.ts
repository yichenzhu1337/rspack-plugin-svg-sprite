import * as path from 'path';

const NAMESPACE = 'rspack-plugin-svg-sprite';

interface LoaderOptions {
  symbolId?: string | ((resourcePath: string) => string);
  extract?: boolean;
  esModule?: boolean;
  spriteFilename?: string;
  publicPath?: string;
}

interface LoaderContext {
  cacheable?: (flag?: boolean) => void;
  resourcePath: string;
  getOptions?: () => LoaderOptions;
  _compilation?: any;
}

function parseViewBox(svgContent: string): string {
  const match = svgContent.match(/viewBox=["']([^"']+)["']/);
  return match ? match[1] : '0 0 24 24';
}

function extractSvgInner(svgContent: string): string {
  const innerMatch = svgContent.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  return innerMatch ? innerMatch[1].trim() : svgContent;
}

function extractSvgAttrs(svgContent: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const svgTagMatch = svgContent.match(/<svg([^>]*)>/i);
  if (!svgTagMatch) return attrs;

  const attrString = svgTagMatch[1];
  const attrRegex = /(\w[\w-]*)=["']([^"']*?)["']/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attrString)) !== null) {
    const name = match[1].toLowerCase();
    if (name !== 'xmlns' && name !== 'version' && name !== 'class' && name !== 'style') {
      attrs[name] = match[2];
    }
  }
  return attrs;
}

function generateSymbolId(resourcePath: string, options: LoaderOptions): string {
  if (typeof options.symbolId === 'function') {
    return options.symbolId(resourcePath);
  }

  const pattern = (options.symbolId as string) || '[name]';
  const basename = path.basename(resourcePath, path.extname(resourcePath));
  const dirname = path.dirname(resourcePath);
  const dirParts = dirname.split(path.sep);
  const dirBasename = dirParts[dirParts.length - 1] || '';

  return pattern
    .replace(/\[name\]/g, basename)
    .replace(/\[folder\]/g, dirBasename)
    .replace(/\[ext\]/g, path.extname(resourcePath).slice(1));
}

function svgSpriteLoader(this: LoaderContext, content: string): string {
  if (this.cacheable) {
    this.cacheable();
  }

  if (!content.includes('<svg')) {
    throw new Error('rspack-plugin-svg-sprite: Invalid SVG content in ' + this.resourcePath);
  }

  const options: LoaderOptions = this.getOptions ? this.getOptions() : {};
  const resourcePath = this.resourcePath;
  const symbolId = generateSymbolId(resourcePath, options);
  const viewBox = parseViewBox(content);
  const innerContent = extractSvgInner(content);
  const svgAttrs = extractSvgAttrs(content);
  const extract = options.extract || false;
  const esModule = options.esModule !== undefined ? options.esModule : true;

  let attrString = 'id="' + symbolId + '"';
  if (viewBox) {
    attrString += ' viewBox="' + viewBox + '"';
  }
  Object.keys(svgAttrs).forEach((key) => {
    if (key !== 'viewbox' && key !== 'id' && key !== 'width' && key !== 'height') {
      attrString += ' ' + key + '="' + svgAttrs[key] + '"';
    }
  });

  const symbolContent = '<symbol ' + attrString + '>' + innerContent + '</symbol>';

  if (extract) {
    const spriteFilename = options.spriteFilename || 'sprite.svg';
    const publicPath = options.publicPath || '';

    const symbolData = {
      id: symbolId,
      viewBox: viewBox,
      content: symbolContent,
      resourcePath: resourcePath,
      spriteFilename: spriteFilename,
    };

    if (this._compilation && this._compilation[NAMESPACE]) {
      this._compilation[NAMESPACE].addSymbol(symbolData);
    }

    const url = publicPath + spriteFilename + '#' + symbolId;

    const symbolModulePath = require.resolve('./runtime/symbol').replace(/\\/g, '\\\\');
    let runtime = 'var SpriteSymbol = require("' + symbolModulePath + '");\n';
    runtime +=
      'var symbol = new SpriteSymbol(' +
      JSON.stringify({ id: symbolId, viewBox: viewBox, content: symbolContent }) +
      ');\n';
    runtime += 'symbol.url = ' + JSON.stringify(url) + ';\n';
    runtime += (esModule ? 'export default' : 'module.exports =') + ' symbol;\n';

    return runtime;
  }

  const symbolModulePath = require.resolve('./runtime/symbol').replace(/\\/g, '\\\\');
  const spriteModulePath = require.resolve('./runtime/browser-sprite').replace(/\\/g, '\\\\');
  let runtime = '';
  runtime += 'var SpriteSymbol = require("' + symbolModulePath + '");\n';
  runtime += 'var sprite = require("' + spriteModulePath + '");\n';
  runtime +=
    'var symbol = new SpriteSymbol(' +
    JSON.stringify({ id: symbolId, viewBox: viewBox, content: symbolContent }) +
    ');\n';
  runtime += 'sprite.add(symbol);\n';
  runtime += (esModule ? 'export default' : 'module.exports =') + ' symbol;\n';

  return runtime;
}

export = Object.assign(svgSpriteLoader, { NAMESPACE });
