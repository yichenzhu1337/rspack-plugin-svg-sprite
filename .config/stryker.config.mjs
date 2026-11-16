// Mutation testing for the loader, the plugin and the runtime modules.
//
// rstest has no Stryker runner plugin, so the generic `command` runner runs the unit tests and
// reads the exit code. The slow integration tests (full Rspack, webpack and Rsbuild builds) are
// excluded: they would make every mutant take minutes.
//
// Some unit tests import `src/__tests__/integration/helpers.ts`, which requires the built
// `dist/index.js`. The sandbox is a copy of the working tree, so `dist/` must exist before Stryker
// starts (`bun run build`) and must not be in `ignorePatterns`, or the copy leaves it out. This
// keeps working when new tests are added; excluding tests one by one did not. `dist/` is built from
// the unmutated source and is not in `mutate`, so tests that go through it cannot kill mutants, but
// they pass. The wall-clock tests in `property/robustness.test.ts` are excluded: they fail on a
// busy machine, which would fail the initial run.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: ['src/loader.ts', 'src/plugin.ts', 'src/runtime/*.ts'],
  testRunner: 'command',
  commandRunner: {
    command:
      'bun run rstest run --bail 1 --silent --coverage.enabled=false' +
      // Excluded: full bundler builds (too slow per mutant) and wall-clock tests (flaky when loaded).
      " --exclude 'src/__tests__/integration/**' --exclude 'src/__tests__/esm-interop.test.ts'" +
      " --exclude 'src/__tests__/esm-entries.test.ts' --exclude 'src/__tests__/robustness.test.ts'" +
      " --exclude 'src/__tests__/property/robustness.test.ts'",
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
  ignorePatterns: ['coverage', 'examples/*/dist', 'reports', '.stryker-tmp', '.git'],
};
