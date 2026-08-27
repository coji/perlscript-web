export class MemoryIO {
  constructor() {
    /** @type {Map<string, import('./types.js').FileHandle>} */
    this.handles = new Map([["STDOUT", { type: "memory", value: "" }]]);
    this.selected = "STDOUT";
    /** @type {((event:Record<string,*>)=>void)|null} */
    this.observer = null;
  }
  /** @param {((event:Record<string,*>)=>void)|null} observer */
  setObserver(observer) { this.observer = observer; }
  /** @param {Record<string,*>} event */
  observe(event) { this.observer?.(event); }
  /** @param {string} name @param {*} spec */
  open(name, spec) { this.handles.set(name, { type: "memory", spec, value: "" }); this.observe({ kind: "io", action: "open", handle: name, target: "memory" }); }
  /** @param {string} name */
  select(name) { this.require(name); this.selected = name; this.observe({ kind: "io", action: "select", handle: name }); }
  /** @param {string} name */
  read(name) { const handle = this.require(name); if (handle.type !== "memory") throw new Error(`${name} is not a memory filehandle`); const value = String(handle.value ?? ""); this.observe({ kind: "io", action: "read", handle: name, bytes: value.length }); return value; }
  /** @param {string} name @param {*} value */
  write(name, value) { const handle = this.require(name); if (handle.type !== "memory") throw new Error(`${name} is not a memory filehandle`); const text = String(value); handle.value = String(handle.value ?? "") + text; this.observe({ kind: "io", action: "write", handle: name, bytes: text.length }); }
  /** @param {string} [name] */
  clear(name = this.selected) { const handle = this.require(name); if (handle.type !== "memory") throw new Error(`${name} is not a memory filehandle`); handle.value = ""; this.observe({ kind: "io", action: "clear", handle: name }); }
  /** @param {string} _handleName @param {string} _subName @param {Function} _callback */
  watch(_handleName, _subName, _callback) { throw new Error("Event handles require BrowserIO"); }
  /** @param {string} name */
  eof(name) { this.require(name); throw new Error("EOF requires a stream filehandle"); }
  /** @param {string} name */
  close(name) { this.require(name); this.handles.delete(name); this.observe({ kind: "io", action: "close", handle: name }); }
  /** @param {string} _name */
  validateUI(_name) { throw new Error("UI handles require BrowserIO"); }
  /** @param {string} _name @param {*} _tree @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} _dispatch */
  commitUI(_name, _tree, _dispatch) { throw new Error("UI handles require BrowserIO"); }
  /** @param {string} name @returns {import('./types.js').FileHandle} */
  require(name) { const handle = this.handles.get(name); if (!handle) throw new Error(`Unknown filehandle ${name}`); return handle; }
  dispose() {}
}
