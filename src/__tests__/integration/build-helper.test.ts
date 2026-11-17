import { describe, it, expect } from '@rstest/core';
import path from 'path';
import { ALL_BUNDLERS, build, makeProject, removeProject, startWatch } from './helpers';

/** A plugin whose only effect is to make `compiler.close` report an error. */
class FailOnClose {
  apply(compiler: any) {
    compiler.hooks.shutdown.tapAsync('FailOnClose', (cb: (err?: Error) => void) =>
      cb(new Error('close failed on purpose')),
    );
  }
}

describe.each(ALL_BUNDLERS)('integration helpers surface close errors ($name)', ({ impl }) => {
  const setup = () => {
    const dir = makeProject({ 'index.js': 'export default 1;\n' });
    const config = {
      mode: 'development',
      devtool: false,
      target: 'node',
      context: dir,
      entry: './index.js',
      output: { path: path.join(dir, 'out') },
      plugins: [new FailOnClose()],
    };
    return { dir, config };
  };

  it('build rejects when compiler.close reports an error', async () => {
    const { dir, config } = setup();
    try {
      await expect(build(impl, config)).rejects.toThrow('close failed on purpose');
    } finally {
      removeProject(dir);
    }
  });

  it('startWatch close rejects when compiler.close reports an error', async () => {
    const { dir, config } = setup();
    try {
      const watcher = await startWatch(impl, config);
      await expect(watcher.close()).rejects.toThrow('close failed on purpose');
    } finally {
      removeProject(dir);
    }
  });
});
