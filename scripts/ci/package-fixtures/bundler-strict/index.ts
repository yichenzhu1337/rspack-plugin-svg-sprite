/// <reference types="rspack-plugin-svg-sprite/client" />
import SvgSpritePlugin from 'rspack-plugin-svg-sprite';
import * as plugin from 'rspack-plugin-svg-sprite/plugin';
import * as loader from 'rspack-plugin-svg-sprite/loader';
import { pluginSvgSprite, type SvgSpritePluginOptions } from 'rspack-plugin-svg-sprite/rsbuild';
import * as browserSprite from 'rspack-plugin-svg-sprite/runtime/browser-sprite';
import * as symbol from 'rspack-plugin-svg-sprite/runtime/symbol';
import icon from './icon.svg';

const instance = new SvgSpritePlugin({ plainSprite: true });
const options: SvgSpritePluginOptions = { extract: true, symbolId: 'icon-[name]' };
const rsbuildPlugin = pluginSvgSprite(options);
const url: string = icon.url;

export const used = [instance, rsbuildPlugin, url, plugin, loader, browserSprite, symbol];

// The declarations must resolve to the real types, not `any`: these lines fail to compile if
// the CommonJS view of a module cannot be resolved.
export const namespace: string = instance.NAMESPACE;
export const another: string = new plugin.default().NAMESPACE;
export const viewBox: string = loader.parseViewBox('<svg viewBox="0 0 1 1"/>');
// @ts-expect-error `plainSprite` is a boolean
new SvgSpritePlugin({ plainSprite: 'yes' });
