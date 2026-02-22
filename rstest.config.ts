import { defineConfig } from '@rstest/core';

export default defineConfig({
  include: ['src/__tests__/**/*.test.ts'],
  output: {
    externals: ['rspack-plugin-svg-sprite', /^rspack-plugin-svg-sprite\//],
  },
});
