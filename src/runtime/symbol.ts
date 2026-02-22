interface SymbolData {
  id: string;
  viewBox: string;
  content: string;
  url?: string;
}

class SpriteSymbol {
  public id: string | null;
  public viewBox: string | null;
  public content: string | null;
  private _url: string | null;

  constructor(data: SymbolData) {
    this.id = data.id;
    this.viewBox = data.viewBox;
    this.content = data.content;
    this._url = data.url || null;
  }

  get url(): string {
    return this._url || '#' + this.id;
  }

  set url(val: string) {
    this._url = val;
  }

  get useUrl(): string {
    return this.url;
  }

  stringify(): string | null {
    return this.content;
  }

  toString(): string {
    return this.url;
  }

  destroy(): void {
    this.id = null;
    this.viewBox = null;
    this.content = null;
  }
}

export default SpriteSymbol;
