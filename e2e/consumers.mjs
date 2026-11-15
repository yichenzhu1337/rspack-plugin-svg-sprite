// The consumer apps under e2e/consumers. Each one is copied to a temp directory, gets the packed
// tarball installed, is built once, and its dist folder is served on its own port.
export const consumers = [
  { name: 'rspack1-inline-cjs', mode: 'inline', port: 4101 },
  { name: 'rspack2-extract-esm', mode: 'extract', port: 4102 },
  { name: 'webpack5-inline', mode: 'inline', port: 4103 },
  { name: 'webpack5-extract', mode: 'extract', port: 4104 },
  { name: 'rsbuild2-extract', mode: 'extract', port: 4105 },
  { name: 'vue3-rspack1-extract', mode: 'extract', port: 4106 },
];

// Symbols every consumer registers at load time, and the one it adds on a click.
export const initialIcons = ['star', 'gradient', 'multi'];
export const lateIcon = 'late';
