'use strict';

class SpriteSymbol {
  constructor(data) {
    this.id = data.id;
    this.viewBox = data.viewBox;
    this.content = data.content;
    this._url = data.url || null;
  }

  get url() {
    return this._url || ('#' + this.id);
  }

  set url(val) {
    this._url = val;
  }

  get useUrl() {
    return this.url;
  }

  stringify() {
    return this.content;
  }

  toString() {
    return this.url;
  }

  destroy() {
    this.id = null;
    this.viewBox = null;
    this.content = null;
  }
}

module.exports = SpriteSymbol;
