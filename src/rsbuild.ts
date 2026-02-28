import * as path from 'path';
import type { RsbuildPlugin } from '@rsbuild/core';
import SvgSpritePlugin from './plugin';

export interface SvgSpritePluginOptions {
  symbolId?: string | ((resourcePath: string) => string);
  extract?: boolean;
  esModule?: boolean;
  spriteFilename?: string;
  publicPath?: string;
  plainSprite?: boolean;
  spriteAttrs?: Record<string, string>;
}

export function pluginSvgSprite(options: SvgSpritePluginOptions = {}): RsbuildPlugin {
  const { plainSprite, spriteAttrs, ...loaderOptions } = options;

  return {
    name: 'rsbuild-plugin-svg-sprite',
    setup(api) {
      api.modifyRspackConfig((config) => {
        config.module = config.module || {};
        config.module.rules = config.module.rules || [];
        config.module.rules.push({
          test: /\.svg$/,
          type: 'javascript/auto' as const,
          loader: path.join(__dirname, 'loader.js'),
          options: {
            symbolId: loaderOptions.symbolId || '[name]',
            extract: loaderOptions.extract || false,
            esModule: loaderOptions.esModule !== false,
            spriteFilename: loaderOptions.spriteFilename || 'sprite.svg',
            publicPath: loaderOptions.publicPath || '',
          },
        });

        if (loaderOptions.extract) {
          config.plugins = config.plugins || [];
          config.plugins.push(new SvgSpritePlugin({ plainSprite, spriteAttrs }));
        }
      });
    },
  };
}
