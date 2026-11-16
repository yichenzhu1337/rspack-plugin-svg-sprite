import { defineConfig } from '@rstest/core';

export default defineConfig({
  include: ['src/__tests__/**/*.test.ts', 'scripts/__tests__/**/*.test.ts'],
  coverage: {
    enabled: true,
    provider: 'istanbul',
    include: ['src/**/*.ts'],
    exclude: ['src/__tests__/**', 'src/index.ts'],
    reporters: ['text', 'html', 'lcov'],
    thresholds: {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
  },
});
