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
