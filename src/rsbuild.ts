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
  include?: RegExp | string;
  exclude?: RegExp | string;
}

export function pluginSvgSprite(options: SvgSpritePluginOptions = {}): RsbuildPlugin {
  const { plainSprite, spriteAttrs, include, exclude, ...loaderOptions } = options;

  return {
    name: 'rsbuild-plugin-svg-sprite',
    setup(api) {
      api.modifyRspackConfig((config) => {
        config.module = config.module || {};
        config.module.rules = config.module.rules || [];

        // Remove existing SVG rules to avoid conflicts
        config.module.rules = config.module.rules.filter((rule: any) => {
          if (!rule || typeof rule !== 'object') return true;
          const test = rule.test;
          if (test instanceof RegExp && test.test('.svg')) return false;
          return true;
        });

        const svgRule: any = {
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
        };

        if (include) svgRule.include = include;
        if (exclude) svgRule.exclude = exclude;

        config.module.rules.push(svgRule);

        if (loaderOptions.extract) {
          config.plugins = config.plugins || [];
          config.plugins.push(new SvgSpritePlugin({ plainSprite, spriteAttrs }));
        }
      });
    },
  };
}
