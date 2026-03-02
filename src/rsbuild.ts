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

/** Returns true when a RegExp targets only .svg files (not a compound pattern). */
export function isSvgOnlyPattern(re: RegExp): boolean {
  // Compound patterns use | for alternation (e.g. /\.(svg|png)$/).
  // If the source contains |, it matches more than just SVG — keep the rule.
  return !re.source.includes('|');
}

export function pluginSvgSprite(options: SvgSpritePluginOptions = {}): RsbuildPlugin {
  const { plainSprite, spriteAttrs, include, exclude, ...loaderOptions } = options;

  return {
    name: 'rsbuild-plugin-svg-sprite',
    setup(api) {
      api.modifyRspackConfig((config) => {
        config.module = config.module || {};
        config.module.rules = config.module.rules || [];

        // Remove existing SVG-only rules to avoid conflicts.
        // Rules with compound patterns (e.g. /\.(svg|png)$/) are kept to avoid
        // breaking non-SVG file handling — users should use include/exclude instead.
        config.module.rules = config.module.rules.filter((rule: any) => {
          if (!rule || typeof rule !== 'object') return true;
          const test = rule.test;
          if (typeof test === 'string') return test !== '.svg';
          if (test instanceof RegExp && test.test('.svg')) {
            // Only remove rules that exclusively target SVG files.
            // Compound patterns like /\.(svg|png|jpg)$/ are kept intact.
            return !isSvgOnlyPattern(test);
          }
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
