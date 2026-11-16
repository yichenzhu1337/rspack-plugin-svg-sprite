// Waits until npm serves rspack-plugin-svg-sprite@<version or dist-tag>, because a package that
// was published a moment ago can take a short while to show up on every registry node.
// Usage: node scripts/wait-for-version.mjs <version|dist-tag> [minutes]
import { execFileSync } from 'node:child_process';

const spec = process.argv[2] || 'latest';
const minutes = Number(process.argv[3] || 5);
const deadline = Date.now() + minutes * 60_000;

if (!/^[\w.+-]+$/.test(spec)) {
  console.error(`❌ "${spec}" is not a version or dist-tag.`);
  process.exit(1);
}

for (;;) {
  try {
    const version = execFileSync(
      'npm',
      ['view', `rspack-plugin-svg-sprite@${spec}`, 'version', '--prefer-online'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (version) {
      console.log(`✅ npm serves rspack-plugin-svg-sprite@${spec} (${version.split('\n').pop()}).`);
      break;
    }
  } catch {
    // not visible yet
  }
  if (Date.now() > deadline) {
    console.error(`❌ rspack-plugin-svg-sprite@${spec} is not on npm after ${minutes} minutes.`);
    process.exit(1);
  }
  console.log(`⏳ rspack-plugin-svg-sprite@${spec} is not on npm yet. Retrying in 15s.`);
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}
