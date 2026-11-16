// `prepare` script: installs the lefthook Git hooks. It never fails the install: it skips in CI
// and when lefthook is absent (for example `bun install --production`), and only warns when
// `lefthook install` itself reports a problem.
import { spawnSync } from 'node:child_process';

if (process.env.CI) {
  console.log('ℹ️ CI detected, skipping Git hook installation');
} else {
  const result = spawnSync('lefthook', ['install'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error || result.status === 127) {
    console.log('ℹ️ lefthook is not installed, skipping Git hook installation');
  } else if (result.status !== 0) {
    console.log('⚠️ lefthook install did not finish. Run `bun run lefthook install` to retry.');
  }
}
