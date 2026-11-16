import { defineConfig } from '@rstest/core';

export default defineConfig({
  // The CI and release scripts only ever run on Linux runners. Their tests drive a bash script
  // and fake `npm`/`gh` commands, so they run on Linux and macOS and are left out on Windows.
  include: [
    'src/__tests__/**/*.test.ts',
    ...(process.platform === 'win32' ? [] : ['scripts/__tests__/**/*.test.ts']),
  ],
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
