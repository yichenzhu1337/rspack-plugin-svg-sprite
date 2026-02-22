import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

interface MockElement {
  tagName: string;
  attributes: Record<string, string>;
  style: Record<string, string>;
  innerHTML: string;
  setAttribute(k: string, v: string): void;
  getAttribute(k: string): string | undefined;
  querySelector(selector: string): { outerHTML: string } | null;
  insertAdjacentHTML(pos: string, html: string): void;
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

function createMockDOM(): MockDocument {
  const elements: Record<string, { outerHTML: string }> = {};
  const body: MockBody = {
    firstChild: null,
    childNodes: [],
    insertBefore(el: MockElement, _ref: MockElement | null) {
      this.childNodes.unshift(el);
      this.firstChild = this.childNodes[0];
    },
  };

  const mockDocument: MockDocument = {
    readyState: 'complete',
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
        innerHTML: '',
        setAttribute(k: string, v: string) { this.attributes[k] = v; },
        getAttribute(k: string) { return this.attributes[k]; },
        querySelector(selector: string) {
          const idMatch = selector.match(/^#(.+)/);
          if (idMatch) {
            return elements[idMatch[1]] || null;
          }
          return null;
        },
        insertAdjacentHTML(_pos: string, html: string) {
          this.innerHTML += html;
          const idMatch = html.match(/id="([^"]+)"/);
          if (idMatch) elements[idMatch[1]] = { outerHTML: html };
        },
      };
      return el;
    },
  };

  return mockDocument;
}

declare const global: { document?: MockDocument };

describe('browser-sprite', () => {
  beforeEach(() => {
    delete require.cache[require.resolve('../dist/runtime/browser-sprite')];
  });

  it('auto-mounts a hidden SVG element into document.body when DOM is ready', () => {
    const mockDoc = createMockDOM();
    (global as any).document = mockDoc;

    const sprite = require('../dist/runtime/browser-sprite');

    assert.equal(mockDoc.body.childNodes.length, 1);
    const svgEl = mockDoc.body.childNodes[0];
    assert.equal(svgEl.tagName, 'SVG');
    assert.equal(svgEl.style.position, 'absolute');
    assert.equal(svgEl.style.width, '0');
    assert.equal(svgEl.style.height, '0');
    assert.equal(svgEl.attributes['aria-hidden'], 'true');

    delete (global as any).document;
  });

  it('appends symbol content to the sprite when add() is called', () => {
    const mockDoc = createMockDOM();
    (global as any).document = mockDoc;

    const sprite = require('../dist/runtime/browser-sprite');

    sprite.add({
      id: 'icon-arrow',
      content: '<symbol id="icon-arrow" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>',
    });

    const svgEl = mockDoc.body.childNodes[0];
    assert.ok(svgEl.innerHTML.includes('icon-arrow'));
    assert.ok(svgEl.innerHTML.includes('<path'));

    delete (global as any).document;
  });

  it('can add multiple symbols', () => {
    const mockDoc = createMockDOM();
    (global as any).document = mockDoc;

    const sprite = require('../dist/runtime/browser-sprite');

    sprite.add({
      id: 'icon-star',
      content: '<symbol id="icon-star" viewBox="0 0 32 32"><polygon points="16,2"/></symbol>',
    });
    sprite.add({
      id: 'icon-circle',
      content: '<symbol id="icon-circle" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></symbol>',
    });

    const svgEl = mockDoc.body.childNodes[0];
    assert.ok(svgEl.innerHTML.includes('icon-star'));
    assert.ok(svgEl.innerHTML.includes('icon-circle'));

    delete (global as any).document;
  });

  it('defers mounting when document is still loading', () => {
    const mockDoc = createMockDOM();
    mockDoc.readyState = 'loading';
    (global as any).document = mockDoc;

    const sprite = require('../dist/runtime/browser-sprite');

    assert.equal(mockDoc.body.childNodes.length, 0);

    sprite.add({
      id: 'deferred-icon',
      content: '<symbol id="deferred-icon" viewBox="0 0 24 24"><rect/></symbol>',
    });

    assert.ok(mockDoc._listeners['DOMContentLoaded']);
    mockDoc._listeners['DOMContentLoaded'].forEach((fn) => fn());

    assert.equal(mockDoc.body.childNodes.length, 1);
    const svgEl = mockDoc.body.childNodes[0];
    assert.ok(svgEl.innerHTML.includes('deferred-icon'));

    delete (global as any).document;
  });
});
