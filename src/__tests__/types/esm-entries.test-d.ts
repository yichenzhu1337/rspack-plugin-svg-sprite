// Compile-time only: the ESM wrapper entries (`*.mts`) must expose the same types as the
// CommonJS entries they wrap.
import esmIndex, { SvgSpritePlugin as EsmNamedPlugin } from '../../index.mjs';
import esmLoader, * as esmLoaderNs from '../../loader.mjs';
import esmPlugin, * as esmPluginNs from '../../plugin.mjs';
import esmRsbuild, { pluginSvgSprite as esmPluginSvgSprite } from '../../rsbuild.mjs';
import type { SvgSpritePluginOptions as EsmOptions } from '../../rsbuild.mjs';
import esmSymbol from '../../runtime/symbol.mjs';
import esmSprite from '../../runtime/browser-sprite.mjs';
import cjsIndex from '../../index';
import cjsLoader, * as cjsLoaderNs from '../../loader';
import cjsPlugin, * as cjsPluginNs from '../../plugin';
import { pluginSvgSprite, type SvgSpritePluginOptions } from '../../rsbuild';
import cjsSymbol from '../../runtime/symbol';
import type { Equal, Expect } from './helpers';

type Instance<T extends abstract new (...args: any) => unknown> = InstanceType<T>;

export type EsmEntryAssertions = [
  // index: default and named export share one type, and it is the CommonJS plugin class
  Expect<Equal<typeof esmIndex, typeof EsmNamedPlugin>>,
  Expect<Equal<typeof esmIndex, typeof cjsIndex>>,
  Expect<Equal<ConstructorParameters<typeof esmIndex>, ConstructorParameters<typeof cjsIndex>>>,
  Expect<Equal<Instance<typeof esmIndex>, Instance<typeof cjsIndex>>>,

  // plugin
  Expect<Equal<ConstructorParameters<typeof esmPlugin>, ConstructorParameters<typeof cjsPlugin>>>,
  Expect<Equal<Instance<typeof esmPlugin>, Instance<typeof cjsPlugin>>>,
  Expect<Equal<typeof esmPluginNs.resolveRawSource, typeof cjsPluginNs.resolveRawSource>>,
  Expect<Equal<typeof esmPluginNs.FallbackRawSource, typeof cjsPluginNs.FallbackRawSource>>,

  // loader
  Expect<Equal<Parameters<typeof esmLoader>, Parameters<typeof cjsLoader>>>,
  Expect<Equal<ReturnType<typeof esmLoader>, ReturnType<typeof cjsLoader>>>,
  Expect<Equal<ThisParameterType<typeof esmLoader>, ThisParameterType<typeof cjsLoader>>>,
  Expect<Equal<typeof esmLoaderNs.NAMESPACE, typeof cjsLoaderNs.NAMESPACE>>,
  Expect<Equal<typeof esmLoaderNs.parseRootTag, typeof cjsLoaderNs.parseRootTag>>,
  Expect<Equal<typeof esmLoaderNs.parseViewBox, typeof cjsLoaderNs.parseViewBox>>,
  Expect<Equal<typeof esmLoaderNs.extractSvgInner, typeof cjsLoaderNs.extractSvgInner>>,
  Expect<Equal<typeof esmLoaderNs.extractSvgAttrs, typeof cjsLoaderNs.extractSvgAttrs>>,
  Expect<Equal<typeof esmLoaderNs.generateSymbolId, typeof cjsLoaderNs.generateSymbolId>>,
  Expect<Equal<typeof esmLoaderNs.legacy, typeof cjsLoaderNs.legacy>>,

  // rsbuild
  Expect<Equal<typeof esmPluginSvgSprite, typeof pluginSvgSprite>>,
  Expect<Equal<EsmOptions, SvgSpritePluginOptions>>,
  Expect<Equal<typeof esmRsbuild.pluginSvgSprite, typeof pluginSvgSprite>>,

  // runtime
  Expect<Equal<ConstructorParameters<typeof esmSymbol>, ConstructorParameters<typeof cjsSymbol>>>,
  Expect<Equal<Instance<typeof esmSymbol>, Instance<typeof cjsSymbol>>>,
  Expect<Equal<typeof esmSprite.add, typeof esmSprite.default.add>>,
];
