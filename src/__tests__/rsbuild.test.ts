import { describe, it, expect } from '@rstest/core';
import { pluginSvgSprite } from '../rsbuild';

describe('pluginSvgSprite (Rsbuild)', () => {
  it('returns a plugin with the correct name', () => {
    const plugin = pluginSvgSprite();
    expect(plugin.name).toBe('rsbuild-plugin-svg-sprite');
    expect(typeof plugin.setup).toBe('function');
  });

  it('uses default options when none are provided', () => {
    const plugin = pluginSvgSprite();
    const config: any = { module: { rules: [] }, plugins: [] };
    const api = {
      modifyRspackConfig: (fn: (config: any) => void) => fn(config),
    };

    plugin.setup(api as any);

    expect(config.module.rules).toHaveLength(1);
    const rule = config.module.rules[0];
    expect(rule.test).toEqual(/\.svg$/);
    expect(rule.type).toBe('javascript/auto');
    expect((rule.loader as string).endsWith('loader.js')).toBe(true);
    expect(rule.options.symbolId).toBe('[name]');
    expect(rule.options.extract).toBe(false);
    expect(rule.options.esModule).toBe(true);
    expect(rule.options.spriteFilename).toBe('sprite.svg');
    expect(rule.options.publicPath).toBe('');
  });

  it('passes custom loader options through', () => {
    const plugin = pluginSvgSprite({
      symbolId: 'icon-[name]',
      extract: false,
      esModule: false,
      spriteFilename: 'icons.svg',
      publicPath: '/assets/',
    });
    const config: any = { module: { rules: [] }, plugins: [] };
    const api = {
      modifyRspackConfig: (fn: (config: any) => void) => fn(config),
    };

    plugin.setup(api as any);

    const rule = config.module.rules[0];
    expect(rule.options.symbolId).toBe('icon-[name]');
    expect(rule.options.extract).toBe(false);
    expect(rule.options.esModule).toBe(false);
    expect(rule.options.spriteFilename).toBe('icons.svg');
    expect(rule.options.publicPath).toBe('/assets/');
  });

  it('adds SvgSpritePlugin when extract is true', () => {
    const plugin = pluginSvgSprite({ extract: true });
    const config: any = { module: { rules: [] }, plugins: [] };
    const api = {
      modifyRspackConfig: (fn: (config: any) => void) => fn(config),
    };

    plugin.setup(api as any);

    expect(config.plugins).toHaveLength(1);
    expect(config.plugins[0].constructor.name).toBe('SvgSpritePlugin');
  });

  it('passes plainSprite and spriteAttrs to SvgSpritePlugin', () => {
    const plugin = pluginSvgSprite({
      extract: true,
      plainSprite: true,
      spriteAttrs: { id: 'my-sprite' },
    });
    const config: any = { module: { rules: [] }, plugins: [] };
    const api = {
      modifyRspackConfig: (fn: (config: any) => void) => fn(config),
    };

    plugin.setup(api as any);

    const pluginInstance = config.plugins[0];
    expect(pluginInstance.config.plainSprite).toBe(true);
    expect(pluginInstance.config.spriteAttrs).toEqual({ id: 'my-sprite' });
  });

  it('does not add SvgSpritePlugin when extract is false', () => {
    const plugin = pluginSvgSprite({ extract: false });
    const config: any = { module: { rules: [] }, plugins: [] };
    const api = {
      modifyRspackConfig: (fn: (config: any) => void) => fn(config),
    };

    plugin.setup(api as any);

    expect(config.plugins).toHaveLength(0);
  });

  it('initializes config.module and config.module.rules if missing', () => {
    const plugin = pluginSvgSprite();
    const config: any = {};
    const api = {
      modifyRspackConfig: (fn: (config: any) => void) => fn(config),
    };

    plugin.setup(api as any);

    expect(config.module.rules).toHaveLength(1);
  });

  it('initializes config.plugins if missing when extract is true', () => {
    const plugin = pluginSvgSprite({ extract: true });
    const config: any = {};
    const api = {
      modifyRspackConfig: (fn: (config: any) => void) => fn(config),
    };

    plugin.setup(api as any);

    expect(config.plugins).toHaveLength(1);
  });
});
