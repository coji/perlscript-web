export class MemoryIO {
  constructor() {
    /** @type {Map<string, import('./types.js').FileHandle>} */
    this.handles = new Map([["STDOUT", { type: "memory", value: "" }]]);
    this.selected = "STDOUT";
  }
  /** @param {string} name @param {*} spec */
  open(name, spec) { this.handles.set(name, { type: "memory", spec, value: "" }); }
  /** @param {string} name */
  select(name) { this.require(name); this.selected = name; }
  /** @param {string} name */
  read(name) { const handle = this.require(name); if (handle.type !== "memory") throw new Error(`${name} is not a memory filehandle`); return String(handle.value ?? ""); }
  /** @param {string} name @param {*} value */
  write(name, value) { const handle = this.require(name); if (handle.type !== "memory") throw new Error(`${name} is not a memory filehandle`); handle.value = String(handle.value ?? "") + value; }
  /** @param {string} [name] */
  clear(name = this.selected) { const handle = this.require(name); if (handle.type !== "memory") throw new Error(`${name} is not a memory filehandle`); handle.value = ""; }
  /** @param {string} _handleName @param {string} _subName @param {Function} _callback */
  watch(_handleName, _subName, _callback) { throw new Error("Event handles require BrowserIO"); }
  /** @param {string} name @returns {import('./types.js').FileHandle} */
  require(name) { const handle = this.handles.get(name); if (!handle) throw new Error(`Unknown filehandle ${name}`); return handle; }
  dispose() {}
}
