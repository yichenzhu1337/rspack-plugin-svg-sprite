// Mutation testing for the loader, the plugin and the runtime modules.
//
// rstest has no Stryker runner plugin, so the generic `command` runner runs the unit tests and
// reads the exit code. The slow integration tests (full Rspack, webpack and Rsbuild builds) and
// the test that needs a built `dist/` are excluded: they would make every mutant take minutes.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: ['src/loader.ts', 'src/plugin.ts', 'src/runtime/*.ts'],
  testRunner: 'command',
  commandRunner: {
    command:
      'bun run rstest run --bail 1 --silent --coverage.enabled=false' +
      // Excluded: tests that run full bundler builds or need a built dist/ (too slow per mutant).
      " --exclude 'src/__tests__/integration/**' --exclude 'src/__tests__/esm-interop.test.ts'" +
      " --exclude 'src/__tests__/esm-entries.test.ts' --exclude 'src/__tests__/robustness.test.ts'",
  },
  // The command runner cannot tell which tests cover a mutant, so every mutant runs every test.
  coverageAnalysis: 'off',
  concurrency: 2,
  timeoutMS: 60000,
  timeoutFactor: 2,
  reporters: ['clear-text', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  // Stryker rewrites tsconfig paths with the TypeScript JS API, which TypeScript 7 does not ship.
  // The sandbox copy needs no rewrite (rstest compiles the sources itself), so point Stryker at
  // a file that does not exist and it skips the step.
  tsconfigFile: 'tsconfig.stryker-unused.json',
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
  // Report only: the score never fails a run.
  thresholds: { high: 90, low: 70, break: null },
  ignorePatterns: ['dist', 'coverage', 'examples/*/dist', 'reports', '.stryker-tmp', '.git'],
};
