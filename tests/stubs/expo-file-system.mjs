export class File {
  constructor(...parts) { this._p = parts.map(p => (p && p.uri) || String(p)).join('/'); this._data = ''; }
  get name() { return this._p.split('/').pop(); }
  get uri() { return 'file://' + this._p; }
  get contentUri() { return 'content://pippo/' + this.name; }
  create() { return this; }
  write(s) { this._data = s; }
  async text() { return this._data; }
  delete() {}
  static async pickFileAsync() { return { canceled: true, result: null }; }
}
export const Paths = { document: { uri: 'file:///tmp/pippo-test/docs' }, cache: { uri: 'file:///tmp/pippo-test/cache' } };
export const Directory = class {};
