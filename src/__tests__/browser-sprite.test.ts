import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import sprite from '../runtime/browser-sprite';

interface MockElement {
  tagName: string;
  attributes: Record<string, string>;
  style: Record<string, string>;
  _children: Array<{ id: string; html: string }>;
  setAttribute(k: string, v: string): void;
  getAttribute(k: string): string | undefined;
  getElementById(id: string): { outerHTML: string } | null;
  insertAdjacentHTML(pos: string, html: string): void;
  readonly innerHTML: string;
}

interface MockBody {
  firstChild: MockElement | null;
  childNodes: MockElement[];
  insertBefore(el: MockElement, ref: MockElement | null): void;
}

interface MockDocument {
  readyState: string;
  body: MockBody;
  _listeners: Record<string, Array<() => void>>;
  addEventListener(event: string, fn: () => void): void;
  createElementNS(ns: string, tag: string): MockElement;
}

function createMockDOM(readyState = 'complete'): MockDocument {
  const body: MockBody = {
    firstChild: null,
    childNodes: [],
    insertBefore(el: MockElement) {
      this.childNodes.unshift(el);
      this.firstChild = this.childNodes[0];
    },
  };

  const mockDocument: MockDocument = {
    readyState,
    body,
    _listeners: {},
    addEventListener(event: string, fn: () => void) {
      this._listeners[event] = this._listeners[event] || [];
      this._listeners[event].push(fn);
    },
    createElementNS(_ns: string, tag: string): MockElement {
      const el: MockElement = {
        tagName: tag.toUpperCase(),
        attributes: {},
        style: {},
        _children: [],
        setAttribute(k: string, v: string) {
          this.attributes[k] = v;
        },
        getAttribute(k: string) {
          return this.attributes[k];
        },
        getElementById(id: string) {
          const child = this._children.find((c) => c.id === id);
          if (child) {
            return {
              get outerHTML() {
                return child.html;
              },
              set outerHTML(val: string) {
                child.html = val;
              },
            };
          }
          return null;
        },
        insertAdjacentHTML(_pos: string, html: string) {
          const idMatch = html.match(/id="([^"]+)"/);
          this._children.push({ id: idMatch ? idMatch[1] : '', html });
        },
        get innerHTML() {
          return this._children.map((c) => c.html).join('');
        },
      };
      return el;
    },
  };

  return mockDocument;
}

describe('browser-sprite', () => {
  beforeEach(() => {
    sprite._reset();
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  it('mounts a hidden SVG element into document.body when mount() is called', () => {
    const mockDoc = createMockDOM();
    (globalThis as any).document = mockDoc;

    sprite.mount();

    expect(mockDoc.body.childNodes.length).toBe(1);
    const svgEl = mockDoc.body.childNodes[0];
    expect(svgEl.tagName).toBe('SVG');
    expect(svgEl.style.position).toBe('absolute');
    expect(svgEl.style.width).toBe('0');
    expect(svgEl.style.height).toBe('0');
    expect(svgEl.attributes['aria-hidden']).toBe('true');
  });

  it('mount() is idempotent — calling it twice does not duplicate the sprite', () => {
    const mockDoc = createMockDOM();
    (globalThis as any).document = mockDoc;

    sprite.mount();
    sprite.mount();

    expect(mockDoc.body.childNodes.length).toBe(1);
  });

  it('appends symbol content to the sprite when add() is called after mount', () => {
    const mockDoc = createMockDOM();
    (globalThis as any).document = mockDoc;

    sprite.mount();
    sprite.add({
      id: 'icon-arrow',
      content: '<symbol id="icon-arrow" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>',
    });

    const svgEl = mockDoc.body.childNodes[0];
    expect(svgEl.innerHTML).toContain('icon-arrow');
    expect(svgEl.innerHTML).toContain('<path');
  });

  it('queues symbols added before mount and flushes on mount', () => {
    const mockDoc = createMockDOM();
    (globalThis as any).document = mockDoc;

    sprite.add({
      id: 'queued-icon',
      content: '<symbol id="queued-icon" viewBox="0 0 24 24"><rect/></symbol>',
    });

    sprite.mount();

    const svgEl = mockDoc.body.childNodes[0];
    expect(svgEl.innerHTML).toContain('queued-icon');
  });

  it('can add multiple symbols', () => {
    const mockDoc = createMockDOM();
    (globalThis as any).document = mockDoc;

    sprite.mount();
    sprite.add({
      id: 'icon-star',
      content: '<symbol id="icon-star" viewBox="0 0 32 32"><polygon points="16,2"/></symbol>',
    });
    sprite.add({
      id: 'icon-circle',
      content:
        '<symbol id="icon-circle" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></symbol>',
    });

    const svgEl = mockDoc.body.childNodes[0];
    expect(svgEl.innerHTML).toContain('icon-star');
    expect(svgEl.innerHTML).toContain('icon-circle');
  });

  it('replaces existing symbol content when adding a symbol with the same id', () => {
    const mockDoc = createMockDOM();
    (globalThis as any).document = mockDoc;

    sprite.mount();
    sprite.add({
      id: 'icon-dup',
      content: '<symbol id="icon-dup">v1</symbol>',
    });
    sprite.add({
      id: 'icon-dup',
      content: '<symbol id="icon-dup">v2</symbol>',
    });

    const svgEl = mockDoc.body.childNodes[0];
    expect(svgEl.innerHTML).toContain('v2');
  });

  it('does not append when sprite is null (add before mount, no flush)', () => {
    const mockDoc = createMockDOM();
    (globalThis as any).document = mockDoc;

    sprite.add({
      id: 'no-mount',
      content: '<symbol id="no-mount"><rect/></symbol>',
    });
  });

  it('skips add() in SSR (no document) to prevent memory leaks', () => {
    delete (globalThis as any).document;

    sprite.add({
      id: 'ssr-icon',
      content: '<symbol id="ssr-icon"><rect/></symbol>',
    });

    // Mount in browser context — ssr-icon should NOT be in the sprite
    const mockDoc = createMockDOM();
    (globalThis as any).document = mockDoc;
    sprite.mount();

    const svgEl = mockDoc.body.childNodes[0];
    expect(svgEl.innerHTML).not.toContain('ssr-icon');
  });
});

describe('autoMount', () => {
  beforeEach(() => {
    sprite._reset();
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  it('auto-mounts immediately when document.readyState is complete', () => {
    const mockDoc = createMockDOM('complete');
    (globalThis as any).document = mockDoc;

    sprite.autoMount();

    expect(mockDoc.body.childNodes.length).toBe(1);
  });

  it('defers mount when document.readyState is loading', () => {
    const mockDoc = createMockDOM('loading');
    (globalThis as any).document = mockDoc;

    sprite.autoMount();

    expect(mockDoc.body.childNodes.length).toBe(0);
    expect(mockDoc._listeners['DOMContentLoaded']).toBeDefined();
    expect(mockDoc._listeners['DOMContentLoaded'].length).toBe(1);

    mockDoc._listeners['DOMContentLoaded'][0]();

    expect(mockDoc.body.childNodes.length).toBe(1);
  });

  it('does nothing when document is undefined', () => {
    delete (globalThis as any).document;
    sprite.autoMount();
  });
});
