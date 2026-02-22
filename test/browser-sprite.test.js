const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

function createMockDOM() {
  const elements = {};
  const body = {
    firstChild: null,
    childNodes: [],
    insertBefore(el, ref) {
      this.childNodes.unshift(el);
      this.firstChild = this.childNodes[0];
    },
  };

  const mockDocument = {
    readyState: 'complete',
    body,
    _listeners: {},
    addEventListener(event, fn) {
      this._listeners[event] = this._listeners[event] || [];
      this._listeners[event].push(fn);
    },
    createElementNS(ns, tag) {
      const el = {
        tagName: tag.toUpperCase(),
        attributes: {},
        style: {},
        innerHTML: '',
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k]; },
        querySelector(selector) {
          const idMatch = selector.match(/^#(.+)/);
          if (idMatch) {
            return elements[idMatch[1]] || null;
          }
          return null;
        },
        insertAdjacentHTML(pos, html) {
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

describe('browser-sprite', () => {
  beforeEach(() => {
    // Clear the module cache so each test gets a fresh sprite instance
    delete require.cache[require.resolve('../runtime/browser-sprite')];
  });

  it('auto-mounts a hidden SVG element into document.body when DOM is ready', () => {
    const mockDoc = createMockDOM();
    global.document = mockDoc;

    const sprite = require('../runtime/browser-sprite');

    assert.equal(mockDoc.body.childNodes.length, 1);
    const svgEl = mockDoc.body.childNodes[0];
    assert.equal(svgEl.tagName, 'SVG');
    assert.equal(svgEl.style.position, 'absolute');
    assert.equal(svgEl.style.width, '0');
    assert.equal(svgEl.style.height, '0');
    assert.equal(svgEl.attributes['aria-hidden'], 'true');

    delete global.document;
  });

  it('appends symbol content to the sprite when add() is called', () => {
    const mockDoc = createMockDOM();
    global.document = mockDoc;

    const sprite = require('../runtime/browser-sprite');

    sprite.add({
      id: 'icon-arrow',
      content: '<symbol id="icon-arrow" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>',
    });

    const svgEl = mockDoc.body.childNodes[0];
    assert.ok(svgEl.innerHTML.includes('icon-arrow'));
    assert.ok(svgEl.innerHTML.includes('<path'));

    delete global.document;
  });

  it('can add multiple symbols', () => {
    const mockDoc = createMockDOM();
    global.document = mockDoc;

    const sprite = require('../runtime/browser-sprite');

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

    delete global.document;
  });

  it('defers mounting when document is still loading', () => {
    const mockDoc = createMockDOM();
    mockDoc.readyState = 'loading';
    global.document = mockDoc;

    const sprite = require('../runtime/browser-sprite');

    // Body should have no sprite yet
    assert.equal(mockDoc.body.childNodes.length, 0);

    // Symbols added before mount are queued
    sprite.add({
      id: 'deferred-icon',
      content: '<symbol id="deferred-icon" viewBox="0 0 24 24"><rect/></symbol>',
    });

    // Simulate DOMContentLoaded
    assert.ok(mockDoc._listeners['DOMContentLoaded']);
    mockDoc._listeners['DOMContentLoaded'].forEach((fn) => fn());

    // Now the sprite should be mounted with the queued symbol
    assert.equal(mockDoc.body.childNodes.length, 1);
    const svgEl = mockDoc.body.childNodes[0];
    assert.ok(svgEl.innerHTML.includes('deferred-icon'));

    delete global.document;
  });
});
