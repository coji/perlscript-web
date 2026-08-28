import { ESCAPED_DOLLAR } from "./lexer.js";
import { parse } from "./parser.js";
import { MemoryIO } from "./io.js";
import { PerlScriptRuntimeError } from "./errors.js";
import { UITreeBuilder } from "./ui.js";

const RETURN = Symbol("return");
/** @param {*} value */
const truthy = value => !(value === "" || value === "0" || value === 0 || value === null || value === undefined || value === false);
/** @param {*} value */
const perlBoolean = value => value ? 1 : "";
/** @param {*} value */
const num = value => Number(value) || 0;
/** @param {*} value @returns {value is {type:symbol,value:*}} */
const isReturnSignal = value => value?.type === RETURN;
const SENSITIVE_NAME = /(?:api[_-]?key|secret|token|password|credential|authorization)/i;

/** @param {never} value */
function assertNever(value) { throw new Error("Unhandled AST node"); }

export class Runtime {
  /** @param {{io?:MemoryIO,maxIterations?:number,onError?:((error:Error)=>void)|null}} [options] */
  constructor({ io = new MemoryIO(), maxIterations = 100000, onError = null } = {}) {
    this.io = io;
    this.maxIterations = maxIterations;
    this.onError = onError;
    /** @type {Record<string,*>} */
    this.scalars = Object.create(null);
    /** @type {Record<string,*[]>} */
    this.arrays = Object.create(null);
    /** @type {Record<string,Record<string,*>>} */
    this.hashes = Object.create(null);
    /** @type {Map<string,import('./types.js').SubStatement>} */
    this.subs = new Map();
    this.source = "";
    /** @type {Map<string,string>} */
    this.mounts = new Map();
    /** @type {UITreeBuilder|null} */
    this.uiBuilder = null;
    this.rendering = false;
    this.dirty = false;
    /** @type {string[]} */
    this.callStack = [];
    /** @type {Array<Record<string,*>>} */
    this.events = [];
    /** @type {Set<(event:Record<string,*>)=>void>} */
    this.observers = new Set();
    this.eventSequence = 0;
    this.lastSub = "";
    this.renderCount = 0;
    this.transactionCount = 0;
    this.io.setObserver(event => this.record(event));
  }

  /** @param {Record<string,*>} event */
  record(event) {
    const entry = { id: ++this.eventSequence, ...event };
    this.events.push(entry);
    if (this.events.length > 200) this.events.shift();
    for (const observer of [...this.observers]) { try { observer(entry); } catch { /* Observers never affect the program. */ } }
  }

  /** @param {(event:Record<string,*>)=>void} observer @returns {()=>void} */
  subscribe(observer) {
    if (typeof observer !== "function") throw new TypeError("Runtime observer must be a function");
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  /** @returns {{scalars:Record<string,*>,arrays:Record<string,*[]>,hashes:Record<string,Record<string,*>>,handles:Array<{name:string,type:string}>,mounts:Array<{handle:string,view:string}>,lastSub:string,renderCount:number,transactionCount:number,events:Array<Record<string,*>>}} */
  inspect() {
    return {
      scalars: this.inspectRecord(this.scalars),
      arrays: this.inspectRecord(this.arrays),
      hashes: this.inspectRecord(this.hashes),
      handles: [...this.io.handles].map(([name, handle]) => ({ name, type: handle.type })),
      mounts: [...this.mounts].map(([handle, view]) => ({ handle, view })),
      lastSub: this.lastSub,
      renderCount: this.renderCount,
      transactionCount: this.transactionCount,
      events: this.events.map(event => ({ ...event })),
    };
  }

  /** @param {Record<string,*>} record @returns {Record<string,*>} */
  inspectRecord(record) {
    const copy = Object.create(null);
    for (const [name, value] of Object.entries(record)) copy[name] = SENSITIVE_NAME.test(name) && value !== "" ? "[redacted]" : this.inspectValue(value);
    return copy;
  }

  /** @param {*} value @returns {*} */
  inspectValue(value) {
    if (Array.isArray(value)) return value.map(item => this.inspectValue(item));
    if (value && typeof value === "object") return this.inspectRecord(value);
    return value;
  }

  /** @param {string} source @returns {Runtime} */
  run(source) { this.source = source.replace(/\r\n?/g, "\n"); return this.execute(parse(this.source)); }
  /** @param {import('./types.js').Program} program @returns {Runtime} */
  execute(program) {
    this.record({ kind: "runtime", action: "start" });
    for (const statement of program.body) if (statement.type === "sub") this.subs.set(statement.name, statement);
    for (const statement of program.body) if (statement.type !== "sub") this.exec(statement);
    this.flushUI();
    this.record({ kind: "runtime", action: "ready" });
    return this;
  }

  /** @param {import('./types.js').Statement} node @returns {*} */
  exec(node) {
    try {
      return this.execNode(node);
    } catch (error) {
      if (isReturnSignal(error) || error instanceof PerlScriptRuntimeError) throw error;
      const cause = error instanceof Error ? error : new Error(String(error));
      throw new PerlScriptRuntimeError(cause.message, { source: this.source, range: node.range, cause });
    }
  }

  /** @param {import('./types.js').Statement} node @returns {*} */
  execNode(node) {
    switch (node.type) {
      case "expressionStatement": return this.eval(node.expression);
      case "sub": return this.subs.set(node.name, node);
      case "open": return this.io.open(node.handle, this.eval(node.spec));
      case "select": return this.io.select(node.handle);
      case "print": return this.io.write(node.handle || this.io.selected, node.values.map(v => this.stringify(this.eval(v))).join(""));
      case "return": throw { type: RETURN, value: node.value ? this.eval(node.value) : "" };
      case "modifier": if (truthy(this.eval(node.test)) !== node.negate) return this.exec(node.statement); return;
      case "if": return this.execBlock((truthy(this.eval(node.test)) !== node.negate) ? node.consequent : node.alternate);
      case "while": {
        let count = 0;
        while (truthy(this.eval(node.test))) {
          if (++count > this.maxIterations) throw new Error("Maximum loop iterations exceeded");
          this.execBlock(node.body);
        }
        return;
      }
      default: return assertNever(node);
    }
  }

  /** @param {import('./types.js').Statement[]} body @returns {void} */
  execBlock(body) { for (const statement of body) this.exec(statement); }

  /** @param {import('./types.js').Expression} node @returns {*} */
  eval(node) {
    try {
      return this.evalNode(node);
    } catch (error) {
      if (isReturnSignal(error) || error instanceof PerlScriptRuntimeError) throw error;
      const cause = error instanceof Error ? error : new Error(String(error));
      throw new PerlScriptRuntimeError(cause.message, { source: this.source, range: node.range, cause });
    }
  }

  /** @param {import('./types.js').Expression} node @returns {*} */
  evalNode(node) {
    switch (node.type) {
      case "literal": return node.value;
      case "string": return node.interpolate ? this.interpolate(node.value) : node.value;
      case "regex": return { regex: true, pattern: this.interpolate(node.pattern), flags: node.flags };
      case "variable": return node.sigil === "@" ? (this.arrays[node.name] ||= []) : node.sigil === "%" ? (this.hashes[node.name] ||= Object.create(null)) : (this.scalars[node.name] ?? "");
      case "bare": return node.name;
      case "arrayLast": return (this.arrays[node.name] ||= []).length - 1;
      case "list": return node.items.map(item => this.eval(item));
      case "index": return (this.indexTarget(node.target)[num(this.eval(node.index))] ?? "");
      case "hashIndex": return (this.hashTarget(node.target)[this.stringify(this.eval(node.key))] ?? "");
      case "read": return this.io.read(node.handle);
      case "assign": { const value = this.eval(node.right); this.assign(node.left, value); return value; }
      case "update": { const old = num(this.eval(node.argument)); this.assign(node.argument, old + (node.op === "++" ? 1 : -1)); return old; }
      case "unary": return node.op === "!" ? perlBoolean(!truthy(this.eval(node.value))) : -num(this.eval(node.value));
      case "binary": return this.binary(node.op, node.left, node.right);
      case "call": return this.call(node.name, node.args.map(arg => this.eval(arg)));
      default: return assertNever(node);
    }
  }

  /** @param {import('./types.js').Expression} node @param {*} value @returns {void} */
  assign(node, value) {
    if (node.type === "variable") {
      if (node.sigil === "@") this.arrays[node.name] = Array.isArray(value) ? value : [value];
      else if (node.sigil === "%") this.hashes[node.name] = this.toHash(value);
      else this.scalars[node.name] = value;
      this.markDirty();
      return;
    }
    if (node.type === "index") { this.indexTarget(node.target)[num(this.eval(node.index))] = value; this.markDirty(); return; }
    if (node.type === "hashIndex") { this.hashTarget(node.target)[this.stringify(this.eval(node.key))] = value; this.markDirty(); return; }
    throw new Error("Invalid assignment target");
  }

  /** @param {string} op @param {import('./types.js').Expression} leftNode @param {import('./types.js').Expression} rightNode @returns {*} */
  binary(op, leftNode, rightNode) {
    const left = this.eval(leftNode);
    if (op === "||") return truthy(left) ? left : this.eval(rightNode);
    if (op === "&&") return truthy(left) ? this.eval(rightNode) : left;
    const right = this.eval(rightNode);
    switch (op) {
      case ".": return this.stringify(left) + this.stringify(right);
      case "+": return num(left) + num(right); case "-": return num(left) - num(right); case "*": return num(left) * num(right); case "/": return num(left) / num(right);
      case "eq": return perlBoolean(String(left) === String(right)); case "ne": return perlBoolean(String(left) !== String(right));
      case "lt": return perlBoolean(String(left) < String(right)); case "le": return perlBoolean(String(left) <= String(right)); case "gt": return perlBoolean(String(left) > String(right)); case "ge": return perlBoolean(String(left) >= String(right));
      case "==": return perlBoolean(num(left) === num(right)); case "!=": return perlBoolean(num(left) !== num(right)); case "<": return perlBoolean(num(left) < num(right)); case "<=": return perlBoolean(num(left) <= num(right)); case ">": return perlBoolean(num(left) > num(right)); case ">=": return perlBoolean(num(left) >= num(right));
      case "=~": case "!~": {
        const rx = right?.regex ? new RegExp(right.pattern, right.flags) : new RegExp(String(right));
        const result = rx.exec(String(left));
        if (result) for (let index = 1; index <= 9; index++) this.scalars[String(index)] = result[index] ?? "";
        return perlBoolean(op === "=~" ? Boolean(result) : !result);
      }
      default: throw new Error(`Unknown operator ${op}`);
    }
  }

  /** @param {string} name @param {*[]} args @returns {*} */
  call(name, args) {
    if (name === "push") { const value = args[0].push(args[1]); this.markDirty(); return value; }
    if (name === "pop") { const value = args[0].pop() ?? ""; this.markDirty(); return value; }
    if (name === "shift") { const value = args[0].shift() ?? ""; this.markDirty(); return value; }
    if (name === "keys") return Object.keys(args[0]);
    if (name === "values") return Object.values(args[0]);
    if (name === "localtime") {
      const date = new Date(num(args[0]) * 1000);
      if (Number.isNaN(date.getTime())) return [];
      const yearStart = new Date(date.getFullYear(), 0, 1);
      const yearDay = Math.floor((date.getTime() - yearStart.getTime()) / 86400000);
      return [date.getSeconds(), date.getMinutes(), date.getHours(), date.getDate(), date.getMonth(), date.getFullYear() - 1900, date.getDay(), yearDay, 0];
    }
    if (name === "encode_json") {
      const value = JSON.stringify(args[0]);
      return value === undefined ? "" : value;
    }
    if (name === "decode_json") return JSON.parse(this.stringify(args[0]));
    if (name === "json_boolean") return Boolean(truthy(args[0]));
    if (name === "json_get") {
      let value = args[0];
      for (const key of args.slice(1)) {
        if (value === null || value === undefined || typeof value !== "object") return "";
        value = value[this.stringify(key)];
      }
      return value ?? "";
    }
    if (name === "clear") return this.io.clear();
    if (name === "eof") return this.io.eof(args[0]);
    if (name === "close") {
      const handle = this.stringify(args[0]);
      this.mounts.delete(handle);
      return this.io.close(handle);
    }
    if (name === "mount") return this.mount(args[0], args[1]);
    if (name === "begin") return this.requireUI(name).begin(args[0], args.slice(1));
    if (name === "text") return this.requireUI(name).text(args[0]);
    if (name === "on") {
      const sub = this.stringify(args[1]);
      if (!this.subs.has(sub)) throw new Error(`Undefined UI event subroutine ${sub}`);
      return this.requireUI(name).on(args[0], sub, args.slice(2));
    }
    if (name === "key") return this.requireUI(name).key(args[0]);
    if (name === "bind") {
      const variable = this.stringify(args[1]).replace(/^\$/, "");
      return this.requireUI(name).bind(args[0], variable, this.scalars[variable] ?? "");
    }
    if (name === "end") return this.requireUI(name).end();
    if (name === "watch") return this.io.watch(args[0], args[1], () => {
      try { this.transaction(() => { this.call(args[1], []); }); }
      catch (error) {
        if (!this.onError) throw error;
        this.onError(error instanceof Error ? error : new Error(String(error)));
      }
    });
    const sub = this.subs.get(name);
    if (!sub) throw new Error(`Undefined subroutine ${name}`);
    this.lastSub = name;
    this.record({ kind: "runtime", action: "call", sub: name, phase: this.rendering ? "render" : "action" });
    const previous = this.arrays._;
    this.arrays._ = args;
    this.callStack.push(name);
    try {
      try { this.execBlock(sub.body); } catch (result) {
        if (isReturnSignal(result)) return result.value;
        if (this.rendering && result instanceof PerlScriptRuntimeError && result.uiStack.length === 0) result.uiStack = [...this.callStack];
        throw result;
      }
      return "";
    } finally {
      this.callStack.pop();
      if (previous === undefined) delete this.arrays._;
      else this.arrays._ = previous;
    }
  }

  /** @param {string} value @returns {string} */
  interpolate(value) {
    const unsupportedCapture = value.match(/\$(\d[A-Za-z0-9_]*)/);
    if (unsupportedCapture && !/^[1-9]$/.test(unsupportedCapture[1])) {
      throw new Error(`Capture variables are limited to $1 through $9; got $${unsupportedCapture[1]}`);
    }
    return value
      .replace(/\$([A-Za-z_]\w*|[1-9])/g, (_match, name) => this.stringify(this.scalars[name] ?? ""))
      .replaceAll(ESCAPED_DOLLAR, "$");
  }
  /** @param {import('./types.js').Expression} node @returns {*[]} */
  indexTarget(node) {
    if (node.type === "variable") return (this.arrays[node.name] ||= []);
    return this.eval(node);
  }
  /** @param {import('./types.js').Expression} node @returns {Record<string,*>} */
  hashTarget(node) {
    if (node.type === "variable") return (this.hashes[node.name] ||= Object.create(null));
    return this.eval(node);
  }
  /** @param {*} value @returns {Record<string,*>} */
  toHash(value) {
    if (!Array.isArray(value)) {
      if (value && typeof value === "object") return value;
      throw new Error("Hash assignment requires a list of key/value pairs");
    }
    if (value.length % 2 !== 0) throw new Error("Hash assignment requires an even number of values");
    const hash = Object.create(null);
    for (let index = 0; index < value.length; index += 2) hash[this.stringify(value[index])] = value[index + 1];
    return hash;
  }
  /** @param {*} value @returns {string} */
  stringify(value) { return value === null || value === undefined ? "" : Array.isArray(value) ? value.map(item => this.stringify(item)).join("") : String(value); }

  /** @param {*} handleValue @param {*} viewValue */
  mount(handleValue, viewValue) {
    if (this.rendering) throw new Error("mount cannot be called while rendering");
    const handle = this.stringify(handleValue);
    const view = this.stringify(viewValue);
    if (!this.subs.has(view)) throw new Error(`Undefined UI view subroutine ${view}`);
    this.io.validateUI(handle);
    if (this.mounts.has(handle)) throw new Error(`UI handle ${handle} is already mounted`);
    this.mounts.set(handle, view);
    this.dirty = true;
    this.record({ kind: "runtime", action: "mount", handle, sub: view });
    return "";
  }

  /** @param {string} operation @returns {UITreeBuilder} */
  requireUI(operation) {
    if (!this.uiBuilder) throw new Error(`${operation} can only be called while rendering UI`);
    return this.uiBuilder;
  }

  markDirty() { if (!this.rendering && this.mounts.size) this.dirty = true; }

  flushUI() {
    if (!this.dirty || !this.mounts.size || this.rendering) return;
    /** @type {Array<[string,import('./ui.js').UITreeBuilder['root']]>} */
    const candidates = [];
    this.dirty = false;
    for (const [handle, view] of this.mounts) {
      const state = this.snapshot();
      const builder = new UITreeBuilder();
      this.uiBuilder = builder;
      this.rendering = true;
      try {
        this.call(view, []);
        try { candidates.push([handle, builder.finish()]); }
        catch (error) {
          if (error instanceof PerlScriptRuntimeError) throw error;
          const cause = error instanceof Error ? error : new Error(String(error));
          throw new PerlScriptRuntimeError(cause.message, { source: this.source, range: this.subs.get(view)?.range, cause, uiStack: [view] });
        }
      }
      finally {
        this.restore(state);
        this.rendering = false;
        this.uiBuilder = null;
      }
    }
    for (const [handle, tree] of candidates) {
      this.io.commitUI(handle, tree,
        (sub, args, updates) => this.dispatchUI(sub, args, updates));
    }
    if (candidates.length) {
      this.renderCount++;
      this.record({ kind: "runtime", action: "render", mounts: candidates.length, count: this.renderCount });
    }
  }

  /** @param {string|null} sub @param {*[]} args @param {Array<[string,*]>} updates */
  dispatchUI(sub, args, updates) {
    try {
      this.transaction(() => {
        for (const [variable, value] of updates) this.scalars[variable] = value;
        if (updates.length) this.markDirty();
        if (sub) this.call(sub, args);
      });
    }
    catch (error) {
      if (!this.onError) throw error;
      this.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** @param {()=>void} action */
  transaction(action) {
    const state = this.snapshot();
    const wasDirty = this.dirty;
    const transaction = ++this.transactionCount;
    this.record({ kind: "runtime", action: "transaction", phase: "start", transaction });
    try { action(); this.flushUI(); this.record({ kind: "runtime", action: "transaction", phase: "commit", transaction }); }
    catch (error) {
      this.restore(state);
      this.dirty = this.mounts.size > 0;
      try { this.flushUI(); } catch { /* Keep the original action error. */ }
      this.dirty = wasDirty;
      this.record({ kind: "runtime", action: "transaction", phase: "rollback", transaction });
      throw error;
    }
  }

  snapshot() {
    return { scalars: this.cloneRecord(this.scalars), arrays: this.cloneRecord(this.arrays), hashes: this.cloneRecord(this.hashes) };
  }

  /** @param {{scalars:Record<string,*>,arrays:Record<string,*>,hashes:Record<string,*>}} state */
  restore(state) { this.scalars = state.scalars; this.arrays = state.arrays; this.hashes = state.hashes; }

  /** @param {Record<string,*>} record */
  cloneRecord(record) {
    const copy = Object.create(null);
    for (const [key, value] of Object.entries(record)) copy[key] = this.cloneValue(value);
    return copy;
  }

  /** @param {*} value @returns {*} */
  cloneValue(value) {
    if (Array.isArray(value)) return value.map(item => this.cloneValue(item));
    if (value && typeof value === "object") return this.cloneRecord(value);
    return value;
  }

  dispose() { this.record({ kind: "runtime", action: "dispose" }); this.io.dispose(); this.observers.clear(); }
}
