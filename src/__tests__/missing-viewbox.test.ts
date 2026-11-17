import { describe, it, expect } from '@rstest/core';
import loader from '../loader';

function run(svg: string, withWarn = true) {
  const warnings: Error[] = [];
  const ctx = {
    resourcePath: '/icons/nosize.svg',
    cacheable() {},
    getOptions: () => ({}),
    ...(withWarn ? { emitWarning: (w: Error) => warnings.push(w) } : {}),
  };
  const output = loader.call(ctx as any, svg) as string;
  return { output, messages: warnings.map((w) => w.message) };
}

describe('missing viewBox warning', () => {
  it('warns once, naming the file, the fallback and the fix', () => {
    const { messages, output } = run(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
    );
    expect(messages).toHaveLength(1);
    const message = messages[0]!;
    expect(message).toContain('[rspack-plugin-svg-sprite]');
    expect(message).toContain('/icons/nosize.svg');
    expect(message).toContain('viewBox="0 0 24 24"');
    expect(message).toContain('width');
    expect(message).toContain('height');
    // The generated module is unchanged: only a warning is added.
    expect(output).toContain('"viewBox":"0 0 24 24"');
  });

  it('warns when only one of width and height is usable', () => {
    expect(run('<svg width="10"><path/></svg>').messages).toHaveLength(1);
    expect(run('<svg width="10" height="50%"><path/></svg>').messages).toHaveLength(1);
  });

  it('warns for a malformed root tag that falls back to the legacy parser', () => {
    expect(run('<svg width=24><path/></svg>').messages).toHaveLength(1);
  });

  it('does not warn when a viewBox is present', () => {
    expect(run('<svg viewBox="0 0 16 16"><path/></svg>').messages).toEqual([]);
    expect(run('<svg width=24 viewBox="0 0 16 16"><path/></svg>').messages).toEqual([]);
  });

  it('does not warn when the viewBox is derived from width and height', () => {
    expect(run('<svg width="16" height="12px"><path/></svg>').messages).toEqual([]);
    expect(run('<svg width=1 width="16" height="12"><path/></svg>').messages).toEqual([]);
  });

  it('does not throw when emitWarning is unavailable', () => {
    expect(run('<svg><path/></svg>', false).output).toContain('"viewBox":"0 0 24 24"');
  });
});
