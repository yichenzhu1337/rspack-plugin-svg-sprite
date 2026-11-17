import * as path from 'path';

export const NAMESPACE = 'rspack-plugin-svg-sprite';

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
  emitWarning?: (warning: Error) => void;
  _compilation?: any;
  _compiler?: any;
  _module?: any;
}

/** Text of the first `<svg ...>` tag, found without the regex's retry from every `<svg`. */
function legacyRootTagText(svgContent: string): string | null {
  const open = /<svg/i.exec(svgContent);
  if (!open) return null;
  const close = svgContent.indexOf('>', open.index + 4);
  return close === -1 ? null : svgContent.slice(open.index + 4, close);
}

function legacyParseViewBox(svgContent: string): string {
  // Extract the root <svg> opening tag to avoid matching attributes on child elements
  const svgTagText = legacyRootTagText(svgContent);
  const svgTag = svgTagText !== null ? svgTagText : '';

  const match = svgTag.match(/viewBox=["']([^"']+)["']/);
  if (match) return match[1]!;

  // Derive viewBox from width/height attributes on the root <svg> tag only
  const widthMatch = svgTag.match(/\bwidth=["'](\d+(?:\.\d+)?)(?:px)?["']/);
  const heightMatch = svgTag.match(/\bheight=["'](\d+(?:\.\d+)?)(?:px)?["']/);
  if (widthMatch && heightMatch) {
    return '0 0 ' + widthMatch[1] + ' ' + heightMatch[1];
  }

  return '0 0 24 24';
}

function legacyExtractSvgInner(svgContent: string): string {
  // Same result as the v1 regex, without its retries: only the first `<svg` can match.
  const open = /<svg/i.exec(svgContent);
  if (!open) return svgContent;
  const tagEnd = svgContent.indexOf('>', open.index + 4);
  if (tagEnd === -1) return svgContent;
  const closer = /<\/svg>/gi;
  closer.lastIndex = tagEnd + 1;
  let last = -1;
  let match: RegExpExecArray | null;
  while ((match = closer.exec(svgContent)) !== null) last = match.index;
  return last === -1 ? svgContent : svgContent.slice(tagEnd + 1, last).trim();
}

function legacyExtractSvgAttrs(svgContent: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrString = legacyRootTagText(svgContent);
  if (attrString === null) return attrs;

  // Match simple attributes but also capture any namespace prefix (e.g. xml:space, xmlns:xlink)
  const attrRegex = /([\w:-]+)=["']([^"']*?)["']/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attrString)) !== null) {
    const raw = match[1]!;
    // Skip namespaced attributes (xml:space, xmlns:xlink) and known non-visual attrs
    if (raw.includes(':')) continue;
    const name = raw.toLowerCase();
    if (name !== 'xmlns' && name !== 'version' && name !== 'class' && name !== 'style') {
      attrs[name] = match[2]!;
    }
  }
  return attrs;
}

interface RootTag {
  /** Root attributes in source order, names and values exactly as written. */
  attrs: Array<[string, string]>;
  /** Index of the first character after the root open tag. */
  end: number;
}

function isXmlSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/**
 * Parses the root `<svg ...>` open tag as XML: quoted values may contain `>` and the other
 * quote character, attribute names keep their case, and `<svg` text inside a comment that
 * precedes the root is skipped.
 *
 * Returns null whenever the tag is not well-formed XML. Callers then run the v1 regex code
 * unchanged, so malformed input behaves exactly as it did before.
 */
export function parseRootTag(svgContent: string): RootTag | null {
  const opener = /<!--|<svg/gi;
  let start = -1;
  let match: RegExpExecArray | null;
  // Once one `-->` search comes back empty, no later one can succeed, so stop searching.
  let hasClose = true;
  while ((match = opener.exec(svgContent)) !== null) {
    if (match[0] === '<!--') {
      if (!hasClose) continue;
      const close = svgContent.indexOf('-->', match.index + 4);
      if (close === -1) hasClose = false;
      else opener.lastIndex = close + 3;
      continue;
    }
    start = match.index + 4;
    break;
  }
  if (start === -1) return null;

  const attrs: Array<[string, string]> = [];
  const n = svgContent.length;
  let i = start;
  for (;;) {
    const wsStart = i;
    while (i < n && isXmlSpace(svgContent[i]!)) i++;
    if (i >= n) return null;
    if (svgContent[i] === '>') return { attrs, end: i + 1 };
    if (i === wsStart) return null;
    const nameStart = i;
    while (i < n && !isXmlSpace(svgContent[i]!) && '=<>"\'/'.indexOf(svgContent[i]!) === -1) i++;
    if (i === nameStart) return null;
    const name = svgContent.slice(nameStart, i);
    while (i < n && isXmlSpace(svgContent[i]!)) i++;
    if (svgContent[i] !== '=') return null;
    i++;
    while (i < n && isXmlSpace(svgContent[i]!)) i++;
    const quote = svgContent[i];
    if (quote !== '"' && quote !== "'") return null;
    const close = svgContent.indexOf(quote, i + 1);
    if (close === -1) return null;
    attrs.push([name, svgContent.slice(i + 1, close)]);
    i = close + 1;
  }
}

function firstAttr(root: RootTag, name: string): string | undefined {
  for (const [attrName, value] of root.attrs) {
    if (attrName === name) return value;
  }
  return undefined;
}

const DIMENSION = /^(\d+(?:\.\d+)?)(?:px)?$/;

export function parseViewBox(svgContent: string): string {
  const root = parseRootTag(svgContent);
  if (!root) return legacyParseViewBox(svgContent);

  const viewBox = firstAttr(root, 'viewBox');
  if (viewBox) return viewBox;

  const widthMatch = DIMENSION.exec(firstAttr(root, 'width') || '');
  const heightMatch = DIMENSION.exec(firstAttr(root, 'height') || '');
  if (widthMatch && heightMatch) {
    return '0 0 ' + widthMatch[1] + ' ' + heightMatch[1];
  }

  return '0 0 24 24';
}

export function extractSvgInner(svgContent: string): string {
  const root = parseRootTag(svgContent);
  if (root) {
    const closer = /<\/svg\s*>/gi;
    closer.lastIndex = root.end;
    let last = -1;
    let match: RegExpExecArray | null;
    while ((match = closer.exec(svgContent)) !== null) last = match.index;
    if (last !== -1) return svgContent.slice(root.end, last).trim();
  }
  return legacyExtractSvgInner(svgContent);
}

function readSvgAttrs(svgContent: string, preserveCase: boolean): Record<string, string> {
  const root = parseRootTag(svgContent);
  if (!root) return legacyExtractSvgAttrs(svgContent);

  const attrs: Record<string, string> = {};
  for (const [name, value] of root.attrs) {
    // Skip namespaced attributes (xml:space, xmlns:xlink) and known non-visual attrs
    if (name.includes(':')) continue;
    const lower = name.toLowerCase();
    if (lower !== 'xmlns' && lower !== 'version' && lower !== 'class' && lower !== 'style') {
      attrs[preserveCase ? name : lower] = value;
    }
  }
  return attrs;
}

/** Root `xmlns:<prefix>` declarations as `[prefix, uri]` pairs, in source order. */
function readNamespaceDecls(svgContent: string): Array<[string, string]> {
  const decls: Array<[string, string]> = [];
  const root = parseRootTag(svgContent);
  if (root) {
    for (const [name, value] of root.attrs) {
      if (name.startsWith('xmlns:')) decls.push([name.slice(6), value]);
    }
    return decls;
  }
  const tag = legacyRootTagText(svgContent) || '';
  const re = /\sxmlns:([\w.-]+)=(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag)) !== null) decls.push([match[1]!, match[2] ?? match[3]!]);
  return decls;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The root's namespace declarations that the icon body uses, as an attribute string. The
 * `<symbol>` does not inherit them, and a used but unbound prefix makes the whole sprite
 * invalid XML. `xlink` is declared on the sprite root already and `xml` is predefined.
 */
function usedNamespaceAttrs(svgContent: string, inner: string): string {
  // Cheap exit for the common icon, which also keeps huge malformed input off a second parse.
  if (!svgContent.includes('xmlns:')) return '';
  let out = '';
  const seen = new Set<string>();
  for (const [prefix, uri] of readNamespaceDecls(svgContent)) {
    if (prefix === 'xlink' || prefix === 'xml' || seen.has(prefix)) continue;
    seen.add(prefix);
    const p = escapeRegExp(prefix);
    if (new RegExp('</?' + p + ':|\\s' + p + ':[^\\s=]+\\s*=').test(inner)) {
      out += ' xmlns:' + prefix + '="' + escapeMarkupAttr(uri) + '"';
    }
  }
  return out;
}

/**
 * Root attributes with lowercased names. The lowercasing is the v1 contract of this exported
 * helper and is kept for backwards compatibility. The loader itself uses the case-preserving
 * variant so attributes such as `preserveAspectRatio` survive into the symbol.
 */
export function extractSvgAttrs(svgContent: string): Record<string, string> {
  return readSvgAttrs(svgContent, false);
}

/** @internal v1 regex helpers, kept verbatim as the fallback for malformed root tags. */
export const legacy = {
  parseViewBox: legacyParseViewBox,
  extractSvgInner: legacyExtractSvgInner,
  extractSvgAttrs: legacyExtractSvgAttrs,
};

export function generateSymbolId(resourcePath: string, options: LoaderOptions): string {
  if (typeof options.symbolId === 'function') {
    return options.symbolId(resourcePath);
  }

  const pattern = (options.symbolId as string) || '[name]';
  const basename = path.basename(resourcePath, path.extname(resourcePath));
  const dirname = path.dirname(resourcePath);
  const dirParts = dirname.split(path.sep);
  const dirBasename = dirParts[dirParts.length - 1] || '';

  return pattern
    .replace(/\[name\]/g, () => basename)
    .replace(/\[folder\]/g, () => dirBasename)
    .replace(/\[ext\]/g, () => path.extname(resourcePath).slice(1));
}

/** Escapes the id for a double-quoted attribute. Ordinary ids, including `>` and `'`, are unchanged. */
function escapeIdAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#9;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;');
}

/** Copied attribute values are already markup; only a quote that would end the attribute is escaped. */
function escapeMarkupAttr(value: string): string {
  return value.replace(/"/g, '&quot;');
}

/** Attribute names that can be written into markup. Namespaced names are filtered earlier. */
const SAFE_ATTR_NAME = /^[A-Za-z_\u00C0-\uFFFF][\w.\-\u00B7\u00C0-\uFFFF]*$/;

/** Only a `%` that would read as an escape sequence is encoded in a fragment. */
function encodeFragment(id: string): string {
  return id.replace(/%(?=[0-9a-fA-F]{2})/g, '%25');
}

const XML_PREDEFINED = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

/** DOCTYPE-declared entities the icon uses (the prolog is not copied, so they end up undeclared). */
function undeclaredEntities(svgContent: string): string[] {
  const doctype = svgContent.indexOf('<!DOCTYPE');
  if (doctype === -1) return [];
  const subsetStart = svgContent.indexOf('[', doctype);
  const rootStart = svgContent.indexOf('<svg', doctype);
  if (subsetStart === -1 || rootStart === -1 || subsetStart > rootStart) return [];
  const subsetEnd = rootStart;

  const declared = new Set<string>();
  const declaration = /<!ENTITY\s+([A-Za-z_:][\w.:-]*)\s/g;
  const subset = svgContent.slice(subsetStart, subsetEnd);
  let match: RegExpExecArray | null;
  while ((match = declaration.exec(subset)) !== null) {
    if (!XML_PREDEFINED.has(match[1]!)) declared.add(match[1]!);
  }
  if (declared.size === 0) return [];

  const used = new Set<string>();
  const reference = /&([A-Za-z_:][\w.:-]*);/g;
  const body = svgContent.slice(subsetEnd);
  while ((match = reference.exec(body)) !== null) {
    if (declared.has(match[1]!)) used.add(match[1]!);
  }
  return Array.from(used);
}

function interopRequire(varName: string, modulePath: string): string {
  return (
    'var _' +
    varName +
    ' = require("' +
    modulePath +
    '");\n' +
    'var ' +
    varName +
    ' = _' +
    varName +
    '.default || _' +
    varName +
    ';\n'
  );
}

function svgSpriteLoader(this: LoaderContext, content: string): string {
  const options: LoaderOptions = this.getOptions ? this.getOptions() : {};

  if (this.cacheable) {
    // Extract mode registers the symbol with SvgSpritePlugin as a side effect of running the
    // loader. A cached module skips the loader, so the symbol would be missing from the sprite
    // on incremental rebuilds and after a persistent-cache restart. Inline mode keeps caching.
    if (options.extract) {
      this.cacheable(false);
    } else {
      this.cacheable();
    }
  }

  if (!content.includes('<svg')) {
    throw new Error('rspack-plugin-svg-sprite: Invalid SVG content in ' + this.resourcePath);
  }

  const moduleType = this._module && this._module.type;
  if (typeof moduleType === 'string' && moduleType.indexOf('asset') === 0 && this.emitWarning) {
    this.emitWarning(
      new Error(
        '[rspack-plugin-svg-sprite] ' +
          this.resourcePath +
          ' is handled as module type "' +
          moduleType +
          '", so the sprite loader output is emitted as a file or data URI instead of being' +
          ' executed, and the icon will not render.\n' +
          'Another rule assigns an asset type to .svg files. Add `type: "javascript/auto"` to' +
          ' the rule that uses rspack-plugin-svg-sprite/loader, or exclude these files from' +
          ' the other rule.',
      ),
    );
  }

  if (this.emitWarning) {
    const entities = undeclaredEntities(content);
    if (entities.length > 0) {
      this.emitWarning(
        new Error(
          '[rspack-plugin-svg-sprite] ' +
            this.resourcePath +
            ' declares the entit' +
            (entities.length === 1 ? 'y ' : 'ies ') +
            entities.map((name) => '&' + name + ';').join(', ') +
            ' in its DOCTYPE and uses ' +
            (entities.length === 1 ? 'it' : 'them') +
            '. The DOCTYPE is not copied into the sprite, so the reference is undeclared there.\n' +
            'Replace it with its literal value, or run SVGO.',
        ),
      );
    }
  }

  const resourcePath = this.resourcePath;
  const symbolId = generateSymbolId(resourcePath, options);
  const viewBox = parseViewBox(content);
  const innerContent = extractSvgInner(content);
  const svgAttrs = readSvgAttrs(content, true);
  const extract = options.extract || false;
  const esModule = options.esModule !== undefined ? options.esModule : true;

  let attrString =
    'id="' + escapeIdAttr(symbolId) + '" viewBox="' + escapeMarkupAttr(viewBox) + '"';
  Object.keys(svgAttrs).forEach((key) => {
    const lower = key.toLowerCase();
    if (lower !== 'viewbox' && lower !== 'id' && lower !== 'width' && lower !== 'height') {
      if (!SAFE_ATTR_NAME.test(key)) return;
      attrString += ' ' + key + '="' + escapeMarkupAttr(svgAttrs[key]!) + '"';
    }
  });

  attrString += usedNamespaceAttrs(content, innerContent);

  const symbolContent = '<symbol ' + attrString + '>' + innerContent + '</symbol>';

  const runtimeDir = path.resolve(__dirname, 'runtime');
  const symbolModulePath = path.join(runtimeDir, 'symbol').replace(/\\/g, '\\\\');
  const spriteModulePath = path.join(runtimeDir, 'browser-sprite').replace(/\\/g, '\\\\');

  if (extract) {
    const spriteFilename = options.spriteFilename || 'sprite.svg';
    let publicPath = options.publicPath || '';
    // 'auto' and function values cannot be read at build time, so the bundler runtime resolves them.
    let runtimePublicPath = false;
    if (!publicPath && this._compiler && this._compiler.options && this._compiler.options.output) {
      const outputPublicPath = this._compiler.options.output.publicPath;
      if (typeof outputPublicPath === 'string' && outputPublicPath !== 'auto') {
        publicPath = outputPublicPath;
      } else if (outputPublicPath === 'auto' || typeof outputPublicPath === 'function') {
        runtimePublicPath = true;
      }
    }
    if (publicPath && !publicPath.endsWith('/')) {
      publicPath += '/';
    }

    const symbolData = {
      id: symbolId,
      viewBox: viewBox,
      content: symbolContent,
      resourcePath: resourcePath,
      spriteFilename: spriteFilename,
    };

    if (this._compilation && this._compilation[NAMESPACE]) {
      this._compilation[NAMESPACE].addSymbol(symbolData);
    } else {
      console.warn(
        '[rspack-plugin-svg-sprite] Extract mode is enabled but SvgSpritePlugin was not found' +
          ' on the compilation.\n' +
          'Add `new SvgSpritePlugin()` to your plugins array for extract mode to work.\n' +
          'Example:\n' +
          "  const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');\n" +
          '  plugins: [new SvgSpritePlugin()]',
      );
    }

    const fragment = spriteFilename + '#' + encodeFragment(symbolId);

    let runtime = interopRequire('SpriteSymbol', symbolModulePath);
    runtime +=
      'var symbol = new SpriteSymbol(' +
      JSON.stringify({ id: symbolId, viewBox: viewBox, content: symbolContent }) +
      ');\n';
    runtime +=
      'symbol.url = ' +
      (runtimePublicPath
        ? '__webpack_public_path__ + ' + JSON.stringify(fragment)
        : JSON.stringify(publicPath + fragment)) +
      ';\n';
    runtime += (esModule ? 'export default' : 'module.exports =') + ' symbol;\n';

    return runtime;
  }

  let runtime = '';
  runtime += interopRequire('SpriteSymbol', symbolModulePath);
  runtime += interopRequire('sprite', spriteModulePath);
  runtime +=
    'var symbol = new SpriteSymbol(' +
    JSON.stringify({ id: symbolId, viewBox: viewBox, content: symbolContent }) +
    ');\n';
  runtime += 'sprite.add(symbol);\n';
  runtime += (esModule ? 'export default' : 'module.exports =') + ' symbol;\n';

  return runtime;
}

const loader = Object.assign(svgSpriteLoader, { NAMESPACE });
export default loader;
