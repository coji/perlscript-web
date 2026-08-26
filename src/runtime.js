import { ESCAPED_DOLLAR } from "./lexer.js";
import { parse } from "./parser.js";
import { MemoryIO } from "./io.js";
import { PerlScriptRuntimeError } from "./errors.js";

const RETURN = Symbol("return");
/** @param {*} value */
const truthy = value => !(value === "" || value === "0" || value === 0 || value === null || value === undefined || value === false);
/** @param {*} value */
const perlBoolean = value => value ? 1 : "";
/** @param {*} value */
const num = value => Number(value) || 0;
/** @param {*} value @returns {value is {type:symbol,value:*}} */
const isReturnSignal = value => value?.type === RETURN;

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
  }

  /** @param {string} source @returns {Runtime} */
  run(source) { this.source = source.replace(/\r\n?/g, "\n"); return this.execute(parse(this.source)); }
  /** @param {import('./types.js').Program} program @returns {Runtime} */
  execute(program) {
    for (const statement of program.body) if (statement.type === "sub") this.subs.set(statement.name, statement);
    for (const statement of program.body) if (statement.type !== "sub") this.exec(statement);
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
      return;
    }
    if (node.type === "index") { this.indexTarget(node.target)[num(this.eval(node.index))] = value; return; }
    if (node.type === "hashIndex") { this.hashTarget(node.target)[this.stringify(this.eval(node.key))] = value; return; }
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
      case "=~": case "!~": { const rx = right?.regex ? new RegExp(right.pattern, right.flags) : new RegExp(String(right)); const match = rx.test(String(left)); return perlBoolean(op === "=~" ? match : !match); }
      default: throw new Error(`Unknown operator ${op}`);
    }
  }

  /** @param {string} name @param {*[]} args @returns {*} */
  call(name, args) {
    if (name === "push") return args[0].push(args[1]);
    if (name === "pop") return args[0].pop() ?? "";
    if (name === "shift") return args[0].shift() ?? "";
    if (name === "keys") return Object.keys(args[0]);
    if (name === "values") return Object.values(args[0]);
    if (name === "clear") return this.io.clear();
    if (name === "watch") return this.io.watch(args[0], args[1], () => {
      try { this.call(args[1], []); }
      catch (error) {
        if (!this.onError) throw error;
        this.onError(error instanceof Error ? error : new Error(String(error)));
      }
    });
    const sub = this.subs.get(name);
    if (!sub) throw new Error(`Undefined subroutine ${name}`);
    const previous = this.arrays._;
    this.arrays._ = args;
    try {
      try { this.execBlock(sub.body); } catch (result) { if (isReturnSignal(result)) return result.value; throw result; }
      return "";
    } finally {
      if (previous === undefined) delete this.arrays._;
      else this.arrays._ = previous;
    }
  }

  /** @param {string} value @returns {string} */
  interpolate(value) {
    return value
      .replace(/\$([A-Za-z_]\w*)/g, (_match, name) => this.stringify(this.scalars[name] ?? ""))
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
  dispose() { this.io.dispose(); }
}
