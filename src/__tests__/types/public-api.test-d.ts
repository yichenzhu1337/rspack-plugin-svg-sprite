// Compile-time only: checked by `pnpm typecheck`, never executed.
import '../../../client';
import SvgSpritePlugin, { SvgSpritePlugin as NamedPlugin } from '../../index';
import loader, { NAMESPACE, parseRootTag, legacy } from '../../loader';
import SpriteSymbol from '../../runtime/symbol';
import { pluginSvgSprite, type SvgSpritePluginOptions } from '../../rsbuild';
import type { RsbuildPlugin } from '@rsbuild/core';
import type { Equal, Expect, IsOptional } from './helpers';
import icon from './fixture.svg';

// ---- Entry: default and named export are the same class ----
export type EntryAssertions = [
  Expect<Equal<(typeof SvgSpritePlugin)['SvgSpritePlugin'], typeof NamedPlugin>>,
  Expect<Equal<(typeof SvgSpritePlugin)['default'], typeof NamedPlugin>>,
  Expect<Equal<InstanceType<typeof SvgSpritePlugin>, InstanceType<typeof NamedPlugin>>>,
];

// ---- Plugin constructor options ----
type PluginOptions = NonNullable<ConstructorParameters<typeof SvgSpritePlugin>[0]>;
export type PluginAssertions = [
  Expect<Equal<ConstructorParameters<typeof SvgSpritePlugin>, [cfg?: PluginOptions | undefined]>>,
  Expect<Equal<keyof PluginOptions, 'plainSprite' | 'spriteAttrs'>>,
  Expect<Equal<PluginOptions['plainSprite'], boolean | undefined>>,
  Expect<Equal<PluginOptions['spriteAttrs'], Record<string, string> | undefined>>,
  Expect<IsOptional<PluginOptions, 'plainSprite'>>,
  Expect<IsOptional<PluginOptions, 'spriteAttrs'>>,
  Expect<Equal<InstanceType<typeof SvgSpritePlugin>['NAMESPACE'], string>>,
  Expect<
    Equal<
      Parameters<InstanceType<typeof SvgSpritePlugin>['generateSprite']>[0][number]['content'],
      string
    >
  >,
  Expect<Equal<ReturnType<InstanceType<typeof SvgSpritePlugin>['generateSprite']>, string>>,
];
new SvgSpritePlugin();
new SvgSpritePlugin({});
new SvgSpritePlugin({ plainSprite: true, spriteAttrs: { id: 'x' } });
// @ts-expect-error unknown option
new SvgSpritePlugin({ nope: true });
// @ts-expect-error plainSprite must be boolean
new SvgSpritePlugin({ plainSprite: 'yes' });
// @ts-expect-error spriteAttrs values must be strings
new SvgSpritePlugin({ spriteAttrs: { a: 1 } });

// ---- Loader options (read through the loader context) ----
type LoaderThis = ThisParameterType<typeof loader>;
type LoaderOptions = ReturnType<NonNullable<LoaderThis['getOptions']>>;
export type LoaderAssertions = [
  Expect<
    Equal<
      keyof LoaderOptions,
      'symbolId' | 'extract' | 'esModule' | 'spriteFilename' | 'publicPath' | 'content'
    >
  >,
  Expect<Equal<LoaderOptions['symbolId'], string | ((resourcePath: string) => string) | undefined>>,
  Expect<Equal<LoaderOptions['extract'], boolean | undefined>>,
  Expect<Equal<LoaderOptions['esModule'], boolean | undefined>>,
  Expect<Equal<LoaderOptions['spriteFilename'], string | undefined>>,
  Expect<Equal<LoaderOptions['publicPath'], string | undefined>>,
  Expect<Equal<LoaderOptions['content'], boolean | undefined>>,
  Expect<IsOptional<LoaderOptions, 'symbolId'>>,
  Expect<IsOptional<LoaderOptions, 'extract'>>,
  Expect<IsOptional<LoaderOptions, 'esModule'>>,
  Expect<IsOptional<LoaderOptions, 'spriteFilename'>>,
  Expect<IsOptional<LoaderOptions, 'publicPath'>>,
  Expect<IsOptional<LoaderOptions, 'content'>>,
  Expect<Equal<typeof NAMESPACE, 'rspack-plugin-svg-sprite'>>,
  Expect<Equal<typeof loader.NAMESPACE, string>>,
  Expect<Equal<LoaderThis['resourcePath'], string>>,
  Expect<Equal<ReturnType<typeof loader>, string>>,
  Expect<Equal<Parameters<typeof loader>, [content: string]>>,
];

// ---- Loader module extras ----
export type LoaderExtrasAssertions = [
  Expect<Equal<Parameters<typeof parseRootTag>, [svgContent: string]>>,
  Expect<
    Equal<ReturnType<typeof parseRootTag>, { attrs: Array<[string, string]>; end: number } | null>
  >,
  Expect<
    Equal<
      typeof legacy,
      {
        parseViewBox: (svgContent: string) => string;
        extractSvgInner: (svgContent: string) => string;
        extractSvgAttrs: (svgContent: string) => Record<string, string>;
      }
    >
  >,
];

// ---- Exported symbol shape ----
type SymbolInstance = InstanceType<typeof SpriteSymbol>;
export type SymbolAssertions = [
  Expect<Equal<SymbolInstance['id'], string | null>>,
  Expect<Equal<SymbolInstance['viewBox'], string | null>>,
  Expect<Equal<SymbolInstance['content'], string | null>>,
  Expect<Equal<SymbolInstance['url'], string>>,
  Expect<Equal<SymbolInstance['useUrl'], string>>,
  Expect<Equal<ReturnType<SymbolInstance['stringify']>, string | null>>,
  Expect<Equal<ReturnType<SymbolInstance['toString']>, string>>,
  Expect<Equal<ReturnType<SymbolInstance['destroy']>, void>>,
  Expect<
    Equal<
      ConstructorParameters<typeof SpriteSymbol>[0],
      { id: string; viewBox: string; content: string; url?: string }
    >
  >,
];
const sym = new SpriteSymbol({ id: 'a', viewBox: '0 0 1 1', content: '<symbol/>' });
sym.url = '/sprite.svg#a';
// @ts-expect-error url must be a string
sym.url = 1;
// @ts-expect-error id is required
new SpriteSymbol({ viewBox: '0 0 1 1', content: '' });

// ---- client.d.ts: `*.svg` module ----
export type SvgModuleAssertions = [
  Expect<Equal<typeof icon, { id: string; viewBox: string; url: string; content: string }>>,
];
// @ts-expect-error not part of the exported shape
void icon.nope;

// ---- Rsbuild plugin factory ----
export type RsbuildAssertions = [
  Expect<Equal<ReturnType<typeof pluginSvgSprite>, RsbuildPlugin>>,
  Expect<Equal<Parameters<typeof pluginSvgSprite>, [options?: SvgSpritePluginOptions | undefined]>>,
  Expect<
    Equal<
      keyof SvgSpritePluginOptions,
      | 'symbolId'
      | 'extract'
      | 'esModule'
      | 'spriteFilename'
      | 'publicPath'
      | 'content'
      | 'plainSprite'
      | 'spriteAttrs'
      | 'include'
      | 'exclude'
    >
  >,
  Expect<Equal<SvgSpritePluginOptions['symbolId'], string | ((p: string) => string) | undefined>>,
  Expect<Equal<SvgSpritePluginOptions['extract'], boolean | undefined>>,
  Expect<Equal<SvgSpritePluginOptions['esModule'], boolean | undefined>>,
  Expect<Equal<SvgSpritePluginOptions['spriteFilename'], string | undefined>>,
  Expect<Equal<SvgSpritePluginOptions['publicPath'], string | undefined>>,
  Expect<Equal<SvgSpritePluginOptions['content'], boolean | undefined>>,
  Expect<Equal<SvgSpritePluginOptions['plainSprite'], boolean | undefined>>,
  Expect<Equal<SvgSpritePluginOptions['spriteAttrs'], Record<string, string> | undefined>>,
  Expect<Equal<SvgSpritePluginOptions['include'], RegExp | string | undefined>>,
  Expect<Equal<SvgSpritePluginOptions['exclude'], RegExp | string | undefined>>,
  Expect<IsOptional<SvgSpritePluginOptions, 'symbolId'>>,
  Expect<IsOptional<SvgSpritePluginOptions, 'extract'>>,
  Expect<IsOptional<SvgSpritePluginOptions, 'esModule'>>,
  Expect<IsOptional<SvgSpritePluginOptions, 'spriteFilename'>>,
  Expect<IsOptional<SvgSpritePluginOptions, 'publicPath'>>,
  Expect<IsOptional<SvgSpritePluginOptions, 'content'>>,
  Expect<IsOptional<SvgSpritePluginOptions, 'plainSprite'>>,
  Expect<IsOptional<SvgSpritePluginOptions, 'spriteAttrs'>>,
  Expect<IsOptional<SvgSpritePluginOptions, 'include'>>,
  Expect<IsOptional<SvgSpritePluginOptions, 'exclude'>>,
];
pluginSvgSprite();
pluginSvgSprite({ extract: true, include: /icons/, symbolId: (p) => p });
// @ts-expect-error unknown option
pluginSvgSprite({ nope: 1 });
// @ts-expect-error extract must be boolean
pluginSvgSprite({ extract: 'yes' });

// ---- Wrong usage is rejected ----
// @ts-expect-error misspelled plugin option
new SvgSpritePlugin({ plainSprit: true });
// @ts-expect-error misspelled plugin option
new SvgSpritePlugin({ spriteAttr: {} });
// @ts-expect-error plugin options must be an object
new SvgSpritePlugin(true);
// @ts-expect-error misspelled Rsbuild option
pluginSvgSprite({ symbolID: 'x' });
// @ts-expect-error misspelled Rsbuild option
pluginSvgSprite({ spriteFileName: 'sprite.svg' });
// @ts-expect-error symbolId must be a string or function
pluginSvgSprite({ symbolId: 1 });
// @ts-expect-error spriteFilename must be a string
pluginSvgSprite({ spriteFilename: 1 });
// @ts-expect-error include must be a RegExp or string
pluginSvgSprite({ include: 1 });
// @ts-expect-error spriteAttrs values must be strings
pluginSvgSprite({ spriteAttrs: { a: 1 } });
// @ts-expect-error the SVG module id is a string
export const wrongId: number = icon.id;
// @ts-expect-error the SVG module url is a string
export const wrongUrl: number = icon.url;
// @ts-expect-error the SVG module content is a string
export const wrongContent: boolean = icon.content;
// @ts-expect-error the SVG module has no `symbol` field
void icon.symbol;
