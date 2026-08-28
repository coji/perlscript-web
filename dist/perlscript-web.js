"use strict";
var PerlScript = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/auto.js
  var auto_exports = {};
  __export(auto_exports, {
    disposeScript: () => disposeScript,
    installImageAdapter: () => installImageAdapter,
    installWebAdapters: () => installWebAdapters,
    registerStream: () => registerStream,
    run: () => run,
    runScripts: () => runScripts,
    setErrorHandler: () => setErrorHandler
  });

  // src/errors.js
  function excerptFor(source, range) {
    if (!source || !range) return "";
    const line = source.split("\n")[range.start.line - 1] || "";
    return `${line}
${" ".repeat(Math.max(0, range.start.column - 1))}^`;
  }
  var PerlScriptSyntaxError = class extends SyntaxError {
    /** @param {string} message @param {{source?:string, range?:import('./types.js').SourceRange, cause?:*}} [options] */
    constructor(message, { source = "", range, cause } = {}) {
      const location = range ? ` at ${range.start.line}:${range.start.column}` : "";
      super(`${message}${location}`, cause === void 0 ? void 0 : { cause });
      this.name = "PerlScriptSyntaxError";
      this.range = range;
      this.excerpt = excerptFor(source, range);
    }
  };
  var PerlScriptRuntimeError = class extends Error {
    /** @param {string} message @param {{source?:string, range?:import('./types.js').SourceRange, cause?:*, uiStack?:string[]}} [options] */
    constructor(message, { source = "", range, cause, uiStack = [] } = {}) {
      const location = range ? ` at ${range.start.line}:${range.start.column}` : "";
      super(`${message}${location}`, cause === void 0 ? void 0 : { cause });
      this.name = "PerlScriptRuntimeError";
      this.range = range;
      this.excerpt = excerptFor(source, range);
      this.uiStack = uiStack;
    }
  };

  // src/lexer.js
  var WORD_OPERATORS = /* @__PURE__ */ new Set(["eq", "ne", "lt", "le", "gt", "ge"]);
  var ESCAPED_DOLLAR = "\uE000";
  var Lexer = class {
    /** @param {string} source */
    constructor(source) {
      this.source = source.replace(/\r\n?/g, "\n");
      this.index = 0;
      this.tokens = [];
      this.lineStarts = [0];
      for (let i = 0; i < this.source.length; i++) if (this.source[i] === "\n") this.lineStarts.push(i + 1);
    }
    /** @returns {import('./types.js').Token[]} */
    tokenize() {
      while (this.index < this.source.length) {
        const start = this.index;
        const c = this.source[this.index];
        if (/\s/.test(c)) {
          this.index++;
          continue;
        }
        if (c === "#") {
          this.skipComment();
          continue;
        }
        if (c === '"' || c === "'") {
          this.tokens.push(this.readString(c));
          continue;
        }
        if (/\d/.test(c)) {
          this.tokens.push(this.readNumber());
          continue;
        }
        if (c === "$" && this.source[this.index + 1] === "#") {
          this.tokens.push(this.readArrayLast());
          continue;
        }
        if (c === "$" || c === "@" || c === "%") {
          this.tokens.push(this.readVariable());
          continue;
        }
        if (/[A-Za-z_]/.test(c)) {
          this.tokens.push(this.readWord());
          continue;
        }
        if (c === "/" && this.canStartRegex()) {
          this.tokens.push(this.readRegex());
          continue;
        }
        const op = ["=~", "!~", "==", "!=", "<=", ">=", "++", "--", "||", "&&"].find((value) => this.source.startsWith(value, this.index));
        if (op) {
          this.index += op.length;
          this.tokens.push(this.token("op", op, start));
          continue;
        }
        if ("{}()[];,<>.=!+-*/".includes(c)) {
          this.index++;
          this.tokens.push(this.token("punct", c, start));
          continue;
        }
        throw this.error(`Unexpected character ${JSON.stringify(c)}`, start, start + 1);
      }
      this.tokens.push(this.token("eof", "", this.index));
      return this.tokens;
    }
    skipComment() {
      while (this.index < this.source.length && this.source[this.index] !== "\n") this.index++;
    }
    /** @returns {import('./types.js').Token} */
    /** @param {string} quote @returns {import('./types.js').Token} */
    readString(quote) {
      const start = this.index++;
      let value = "";
      while (this.index < this.source.length) {
        const c = this.source[this.index++];
        if (c === quote) return this.token("string", value, start, { interpolate: quote === '"' });
        if (c === "\\") {
          const n = this.source[this.index++];
          if (n === void 0) throw this.error("Unterminated string", start, this.index);
          if (quote === "'") value += n === "\\" || n === "'" ? n : `\\${n}`;
          else if (n === "$") value += ESCAPED_DOLLAR;
          else {
            const escapes = { n: "\n", t: "	", r: "\r", "\\": "\\", '"': '"' };
            value += escapes[n] ?? `\\${n}`;
          }
        } else value += c;
      }
      throw this.error("Unterminated string", start, this.index);
    }
    /** @returns {import('./types.js').Token} */
    readNumber() {
      const start = this.index;
      while (/\d/.test(this.source[this.index] || "")) this.index++;
      if (this.source[this.index] === "." && /\d/.test(this.source[this.index + 1] || "")) {
        this.index++;
        while (/\d/.test(this.source[this.index] || "")) this.index++;
        if (this.source[this.index] === "." && /\d/.test(this.source[this.index + 1] || "")) {
          throw this.error("Malformed number", start, this.index + 2);
        }
      }
      const raw = this.source.slice(start, this.index);
      return this.token("number", raw, start, { number: Number(raw) });
    }
    /** @returns {import('./types.js').Token} */
    readVariable() {
      const start = this.index;
      const sigil = this.source[this.index++];
      const nameStart = this.index;
      if (/\d/.test(this.source[this.index] || "")) {
        while (/[A-Za-z0-9_]/.test(this.source[this.index] || "")) this.index++;
        const name = this.source.slice(nameStart, this.index);
        if (sigil !== "$" || !/^[1-9]$/.test(name)) {
          throw this.error(`Capture variables are limited to $1 through $9; got ${sigil}${name}`, start, this.index);
        }
        return this.token("variable", name, start, { sigil });
      }
      while (/[A-Za-z0-9_]/.test(this.source[this.index] || "")) this.index++;
      if (nameStart === this.index) throw this.error("Missing variable name", start, this.index);
      return this.token("variable", this.source.slice(nameStart, this.index), start, { sigil });
    }
    /** @returns {import('./types.js').Token} */
    readArrayLast() {
      const start = this.index;
      this.index += 2;
      const nameStart = this.index;
      while (/[A-Za-z0-9_]/.test(this.source[this.index] || "")) this.index++;
      if (nameStart === this.index) throw this.error("Missing array name", start, this.index);
      return this.token("arrayLast", this.source.slice(nameStart, this.index), start);
    }
    /** @returns {import('./types.js').Token} */
    readWord() {
      const start = this.index;
      while (/[A-Za-z0-9_]/.test(this.source[this.index] || "")) this.index++;
      const value = this.source.slice(start, this.index);
      return this.token(WORD_OPERATORS.has(value) ? "op" : "word", value, start);
    }
    canStartRegex() {
      const prev = this.tokens.at(-1);
      return prev?.value === "=~" || prev?.value === "!~";
    }
    /** @returns {import('./types.js').Token} */
    readRegex() {
      const start = this.index++;
      let pattern = "";
      while (this.index < this.source.length) {
        const c = this.source[this.index++];
        if (c === "\\") {
          pattern += c + (this.source[this.index++] || "");
          continue;
        }
        if (c === "/") {
          let flags = "";
          while (/[gimsuy]/.test(this.source[this.index] || "")) flags += this.source[this.index++];
          return this.token("regex", pattern, start, { flags });
        }
        pattern += c;
      }
      throw this.error("Unterminated regular expression", start, this.index);
    }
    /** @param {string} type @param {string} value @param {number} start @param {Partial<import('./types.js').Token>} [extra] @returns {import('./types.js').Token} */
    token(type, value, start, extra = {}) {
      return { type, value, range: this.range(start, this.index), ...extra };
    }
    /** @param {number} start @param {number} end @returns {import('./types.js').SourceRange} */
    range(start, end) {
      return { start: this.position(start), end: this.position(end) };
    }
    /** @param {number} offset @returns {import('./types.js').SourcePosition} */
    position(offset) {
      let low = 0;
      let high = this.lineStarts.length;
      while (low + 1 < high) {
        const middle = low + high >> 1;
        if (this.lineStarts[middle] <= offset) low = middle;
        else high = middle;
      }
      return { offset, line: low + 1, column: offset - this.lineStarts[low] + 1 };
    }
    /** @param {string} message @param {number} start @param {number} end */
    error(message, start, end) {
      return new PerlScriptSyntaxError(message, { source: this.source, range: this.range(start, end) });
    }
  };
  function tokenize(source) {
    return new Lexer(source).tokenize();
  }

  // src/parser.js
  var PRECEDENCE = { "||": 1, "&&": 2, eq: 3, ne: 3, lt: 3, le: 3, gt: 3, ge: 3, "==": 3, "!=": 3, "<": 3, ">": 3, "<=": 3, ">=": 3, "=~": 3, "!~": 3, ".": 4, "+": 5, "-": 5, "*": 6, "/": 6 };
  var rangeFrom = (start, end) => ({ start: start.range.start, end: end.range.end });
  var Parser = class {
    /** @param {string} source */
    constructor(source) {
      this.source = source.replace(/\r\n?/g, "\n");
      this.tokens = tokenize(this.source);
      this.index = 0;
    }
    /** @returns {import('./types.js').Token} */
    peek(n = 0) {
      return this.tokens[this.index + n] || this.tokens.at(-1);
    }
    /** @returns {import('./types.js').Token} */
    take() {
      return this.tokens[this.index++] || this.tokens.at(-1);
    }
    /** @param {string} value */
    is(value) {
      return this.peek().value === value;
    }
    /** @param {string} value @returns {import('./types.js').Token} */
    expect(value) {
      const token = this.take();
      if (token.value !== value) throw this.error(`Expected ${value}, got ${token.value || "EOF"}`, token);
      return token;
    }
    /** @param {string} context @returns {import('./types.js').Token} */
    expectWord(context) {
      const token = this.take();
      if (token.type !== "word") throw this.error(`Expected ${context}, got ${token.value || "EOF"}`, token);
      return token;
    }
    /** @returns {import('./types.js').Program} */
    parse() {
      const start = this.peek();
      const body = [];
      while (this.peek().type !== "eof") body.push(this.statement());
      return { type: "program", body, range: rangeFrom(start, this.peek()) };
    }
    /** @returns {import('./types.js').Statement} */
    statement() {
      if (this.is("sub")) return this.subroutine();
      if (this.is("if") || this.is("unless")) return this.conditional();
      if (this.is("while")) return this.whileStatement();
      if (this.is("return")) return this.returnStatement();
      if (this.is("open")) return this.openStatement();
      if (this.is("select")) return this.selectStatement();
      if (this.is("print")) return this.printStatement();
      const expression = this.expression();
      return this.finishStatement({ type: "expressionStatement", expression, range: expression.range });
    }
    /** @returns {{body:import('./types.js').Statement[],open:import('./types.js').Token,close:import('./types.js').Token}} */
    block() {
      const open = this.expect("{");
      const body = [];
      while (!this.is("}")) {
        if (this.peek().type === "eof") throw this.error("Expected }, got EOF", this.peek());
        body.push(this.statement());
      }
      const close = this.expect("}");
      return { body, open, close };
    }
    /** @returns {import('./types.js').SubStatement} */
    subroutine() {
      const start = this.expect("sub");
      const name = this.expectWord("subroutine name");
      const block = this.block();
      return { type: "sub", name: name.value, body: block.body, range: rangeFrom(start, block.close) };
    }
    /** @returns {import('./types.js').IfStatement} */
    conditional() {
      const start = this.take();
      const negate = start.value === "unless";
      this.expect("(");
      const test = this.expression();
      this.expect(")");
      const consequent = this.block();
      let alternate = [];
      let end = consequent.close;
      if (this.is("else")) {
        this.take();
        const alternative = this.block();
        alternate = alternative.body;
        end = alternative.close;
      }
      return { type: "if", negate, test, consequent: consequent.body, alternate, range: rangeFrom(start, end) };
    }
    /** @returns {import('./types.js').WhileStatement} */
    whileStatement() {
      const start = this.expect("while");
      this.expect("(");
      const test = this.expression();
      this.expect(")");
      const block = this.block();
      return { type: "while", test, body: block.body, range: rangeFrom(start, block.close) };
    }
    /** @returns {import('./types.js').Statement} */
    returnStatement() {
      const start = this.expect("return");
      const value = this.is(";") || this.is("if") || this.is("unless") ? null : this.expression();
      return this.finishStatement({ type: "return", value, range: value ? rangeFrom(start, value) : start.range });
    }
    /** @returns {import('./types.js').OpenStatement} */
    openStatement() {
      const start = this.expect("open");
      const handle = this.expectWord("filehandle");
      this.expect(",");
      const spec = this.expression();
      const end = this.expect(";");
      return { type: "open", handle: handle.value, spec, range: rangeFrom(start, end) };
    }
    /** @returns {import('./types.js').SelectStatement} */
    selectStatement() {
      const start = this.expect("select");
      const handle = this.expectWord("filehandle");
      const end = this.expect(";");
      return { type: "select", handle: handle.value, range: rangeFrom(start, end) };
    }
    /** @returns {import('./types.js').Statement} */
    printStatement() {
      const start = this.expect("print");
      let handle = null;
      if (this.peek().type === "word" && this.peek(1).value !== "(" && this.peek(1).value !== ";") handle = this.take().value;
      const values = [];
      if (!this.is(";")) {
        values.push(this.expression());
        while (this.is(",")) {
          this.take();
          values.push(this.expression());
        }
      }
      const last = values.at(-1) || start;
      return this.finishStatement({ type: "print", handle, values, range: rangeFrom(start, last) });
    }
    /** @param {import('./types.js').Statement} node @returns {import('./types.js').Statement} */
    finishStatement(node) {
      let result = node;
      if (this.is("if") || this.is("unless")) {
        const keyword = this.take();
        const test = this.expression();
        result = { type: "modifier", negate: keyword.value === "unless", test, statement: node, range: rangeFrom(node, test) };
      }
      const semicolon = this.expect(";");
      return { ...result, range: rangeFrom(result, semicolon) };
    }
    /** @returns {import('./types.js').Expression} */
    expression(min = 0) {
      let left = this.postfix();
      if (this.is("=")) {
        this.take();
        const right = this.expression();
        return { type: "assign", left, right, range: rangeFrom(left, right) };
      }
      while (true) {
        const op = this.peek().value;
        const precedence = PRECEDENCE[op];
        if (!precedence || precedence <= min) break;
        this.take();
        const right = this.expression(precedence);
        left = { type: "binary", op, left, right, range: rangeFrom(left, right) };
      }
      return left;
    }
    /** @returns {import('./types.js').Expression} */
    postfix() {
      let node = this.prefix();
      while (this.is("++") || this.is("--")) {
        const update = this.take();
        node = { type: "update", op: update.value, argument: node, range: rangeFrom(node, update) };
      }
      return node;
    }
    /** @returns {import('./types.js').Expression} */
    prefix() {
      const token = this.take();
      if (token.type === "number") return { type: "literal", value: token.number, range: token.range };
      if (token.type === "string") return { type: "string", value: token.value, interpolate: Boolean(token.interpolate), range: token.range };
      if (token.type === "regex") return { type: "regex", pattern: token.value, flags: token.flags || "", range: token.range };
      if (token.type === "arrayLast") return { type: "arrayLast", name: token.value, range: token.range };
      if (token.type === "variable") {
        const node = { type: (
          /** @type {'variable'} */
          "variable"
        ), sigil: token.sigil || "", name: token.value, range: token.range };
        if (this.is("[")) {
          this.take();
          const index = this.expression();
          const close = this.expect("]");
          return { type: "index", target: node, index, range: rangeFrom(token, close) };
        }
        if (this.is("{")) {
          this.take();
          const key = this.expression();
          const close = this.expect("}");
          return { type: "hashIndex", target: node, key, range: rangeFrom(token, close) };
        }
        return node;
      }
      if (token.value === "(") {
        if (this.is(")")) {
          const close2 = this.take();
          return { type: "list", items: [], range: rangeFrom(token, close2) };
        }
        const first = this.expression();
        if (this.is(",")) {
          const items = [first];
          while (this.is(",")) {
            this.take();
            if (this.is(")")) break;
            items.push(this.expression());
          }
          const close2 = this.expect(")");
          return { type: "list", items, range: rangeFrom(token, close2) };
        }
        const close = this.expect(")");
        return { ...first, range: rangeFrom(token, close) };
      }
      if (token.value === "!" || token.value === "-") {
        const value = this.expression(7);
        return { type: "unary", op: token.value, value, range: rangeFrom(token, value) };
      }
      if (token.value === "<") {
        const handle = this.expectWord("filehandle");
        const close = this.expect(">");
        return { type: "read", handle: handle.value, range: rangeFrom(token, close) };
      }
      if (token.value === "do") {
        const name = this.expectWord("subroutine name");
        const call = this.arguments();
        return { type: "call", name: name.value, args: call.args, range: rangeFrom(token, call.close) };
      }
      if (token.type === "word") {
        if (this.is("(")) {
          const call = this.arguments();
          return { type: "call", name: token.value, args: call.args, range: rangeFrom(token, call.close) };
        }
        return { type: "bare", name: token.value, range: token.range };
      }
      throw this.error(`Unexpected token ${token.value || "EOF"}`, token);
    }
    /** @returns {{args:import('./types.js').Expression[],close:import('./types.js').Token}} */
    arguments() {
      this.expect("(");
      const args = [];
      if (!this.is(")")) {
        args.push(this.expression());
        while (this.is(",")) {
          this.take();
          args.push(this.expression());
        }
      }
      return { args, close: this.expect(")") };
    }
    /** @param {string} message @param {import('./types.js').Token} token */
    error(message, token) {
      return new PerlScriptSyntaxError(message, { source: this.source, range: token.range });
    }
  };
  function parse(source) {
    return new Parser(source).parse();
  }

  // src/io.js
  var MemoryIO = class {
    constructor() {
      this.handles = /* @__PURE__ */ new Map([["STDOUT", { type: "memory", value: "" }]]);
      this.selected = "STDOUT";
      this.observer = null;
    }
    /** @param {((event:Record<string,*>)=>void)|null} observer */
    setObserver(observer) {
      this.observer = observer;
    }
    /** @param {Record<string,*>} event */
    observe(event) {
      this.observer?.(event);
    }
    /** @param {string} name @param {*} spec */
    open(name, spec) {
      this.handles.set(name, { type: "memory", spec, value: "" });
      this.observe({ kind: "io", action: "open", handle: name, target: "memory" });
    }
    /** @param {string} name */
    select(name) {
      this.require(name);
      this.selected = name;
      this.observe({ kind: "io", action: "select", handle: name });
    }
    /** @param {string} name */
    read(name) {
      const handle = this.require(name);
      if (handle.type !== "memory") throw new Error(`${name} is not a memory filehandle`);
      const value = String(handle.value ?? "");
      this.observe({ kind: "io", action: "read", handle: name, bytes: value.length });
      return value;
    }
    /** @param {string} name @param {*} value */
    write(name, value) {
      const handle = this.require(name);
      if (handle.type !== "memory") throw new Error(`${name} is not a memory filehandle`);
      const text = String(value);
      handle.value = String(handle.value ?? "") + text;
      this.observe({ kind: "io", action: "write", handle: name, bytes: text.length });
    }
    /** @param {string} [name] */
    clear(name = this.selected) {
      const handle = this.require(name);
      if (handle.type !== "memory") throw new Error(`${name} is not a memory filehandle`);
      handle.value = "";
      this.observe({ kind: "io", action: "clear", handle: name });
    }
    /** @param {string} _handleName @param {string} _subName @param {Function} _callback */
    watch(_handleName, _subName, _callback) {
      throw new Error("Event handles require BrowserIO");
    }
    /** @param {string} name */
    eof(name) {
      this.require(name);
      throw new Error("EOF requires a stream filehandle");
    }
    /** @param {string} name */
    close(name) {
      this.require(name);
      this.handles.delete(name);
      this.observe({ kind: "io", action: "close", handle: name });
    }
    /** @param {string} _name */
    validateUI(_name) {
      throw new Error("UI handles require BrowserIO");
    }
    /** @param {string} _name @param {*} _tree @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} _dispatch */
    commitUI(_name, _tree, _dispatch) {
      throw new Error("UI handles require BrowserIO");
    }
    /** @param {string} name @returns {import('./types.js').FileHandle} */
    require(name) {
      const handle = this.handles.get(name);
      if (!handle) throw new Error(`Unknown filehandle ${name}`);
      return handle;
    }
    dispose() {
    }
  };

  // src/ui.js
  var BLOCKED_TAGS = /* @__PURE__ */ new Set(["base", "embed", "iframe", "link", "meta", "object", "script", "style"]);
  var BOOLEAN_ATTRIBUTES = /* @__PURE__ */ new Set(["checked", "disabled", "hidden", "multiple", "open", "readonly", "required", "selected"]);
  var URL_ATTRIBUTES = /* @__PURE__ */ new Set(["action", "formaction", "href", "src"]);
  var TAG = /^[a-z][a-z0-9-]*$/;
  var ATTRIBUTE = /^[A-Za-z_:][A-Za-z0-9_.:-]*$/;
  var EVENT = /^[a-z][a-z0-9]*$/;
  var perlTrue = (value) => !(value === "" || value === "0" || value === 0 || value === null || value === void 0 || value === false);
  var stringValue = (value) => value === null || value === void 0 ? "" : String(value);
  var UITreeBuilder = class {
    constructor() {
      this.root = { type: "root", children: [] };
      this.stack = [this.root];
    }
    /** @returns {UIRoot|UIElement} */
    current() {
      return this.stack[this.stack.length - 1];
    }
    /** @param {*} tagValue @param {*[]} attributePairs */
    begin(tagValue, attributePairs) {
      const tag = stringValue(tagValue).toLowerCase();
      if (!TAG.test(tag) || BLOCKED_TAGS.has(tag)) throw new Error(`Unsafe or invalid UI tag ${tag || "(empty)"}`);
      if (attributePairs.length % 2 !== 0) throw new Error(`UI element ${tag} requires attribute name/value pairs`);
      const attrs = /* @__PURE__ */ Object.create(null);
      for (let index = 0; index < attributePairs.length; index += 2) {
        const name = stringValue(attributePairs[index]);
        const lower = name.toLowerCase();
        const value = attributePairs[index + 1];
        if (!ATTRIBUTE.test(name) || lower.startsWith("on") || lower === "innerhtml" || lower === "outerhtml" || lower === "srcdoc") {
          throw new Error(`Unsafe or invalid UI attribute ${name || "(empty)"}`);
        }
        if (URL_ATTRIBUTES.has(lower) && /^\s*javascript:/i.test(stringValue(value))) throw new Error(`Unsafe URL for UI attribute ${name}`);
        attrs[name] = value;
      }
      const node = { type: "element", tag, attrs, events: /* @__PURE__ */ Object.create(null), bindings: [], key: null, children: [] };
      this.current().children.push(node);
      this.stack.push(node);
    }
    /** @param {*} value */
    text(value) {
      this.current().children.push({ type: "text", value: stringValue(value) });
    }
    /** @param {*} eventValue @param {*} subValue @param {*[]} args */
    on(eventValue, subValue, args = []) {
      const node = this.element("on");
      const event = stringValue(eventValue).toLowerCase();
      const sub = stringValue(subValue);
      if (!EVENT.test(event)) throw new Error(`Invalid UI event ${event || "(empty)"}`);
      if (!sub) throw new Error("UI event requires a subroutine name");
      node.events[event] = { sub, args };
    }
    /** @param {*} value */
    key(value) {
      const node = this.element("key");
      if (node.key !== null) throw new Error("UI element already has a key");
      node.key = stringValue(value);
    }
    /** @param {*} propertyValue @param {*} variableValue @param {*} value */
    bind(propertyValue, variableValue, value) {
      const node = this.element("bind");
      const property = stringValue(propertyValue);
      const variable = stringValue(variableValue).replace(/^\$/, "");
      if (property !== "value" && property !== "checked") throw new Error(`Unsupported UI binding property ${property || "(empty)"}`);
      const valueTag = node.tag === "input" || node.tag === "textarea" || node.tag === "select";
      const inputType = stringValue(node.attrs.type).toLowerCase();
      const checkedInput = node.tag === "input" && (inputType === "checkbox" || inputType === "radio");
      if (property === "value" && !valueTag || property === "checked" && !checkedInput) {
        throw new Error(`${node.tag} does not support UI binding property ${property}`);
      }
      if (!/^[A-Za-z_]\w*$/.test(variable)) throw new Error(`Invalid UI binding scalar ${variable || "(empty)"}`);
      if (node.bindings.some((binding) => binding.property === property)) throw new Error(`Duplicate UI binding for ${property}`);
      node.bindings.push({ property, variable, value });
    }
    end() {
      if (this.stack.length === 1) throw new Error("Cannot close the UI root");
      this.stack.pop();
    }
    /** @returns {UIRoot} */
    finish() {
      if (this.stack.length !== 1) throw new Error(`Unclosed UI element ${/** @type {UIElement} */
      this.current().tag}`);
      this.validateKeys(this.root);
      return this.root;
    }
    /** @param {UIRoot|UIElement} parent */
    validateKeys(parent) {
      const keys = /* @__PURE__ */ new Set();
      for (const child of parent.children) {
        if (child.type !== "element") continue;
        if (child.key !== null) {
          if (keys.has(child.key)) throw new Error(`Duplicate UI key ${child.key}`);
          keys.add(child.key);
        }
        this.validateKeys(child);
      }
    }
    /** @param {string} operation @returns {UIElement} */
    element(operation) {
      const current = this.current();
      if (current.type !== "element") throw new Error(`${operation} requires a current UI element`);
      return current;
    }
  };
  var DOMUIRenderer = class {
    /** @param {Document} document @param {Element} root */
    constructor(document2, root) {
      this.document = document2;
      this.root = root;
      this.tree = null;
    }
    /**
     * @param {UIRoot} tree
     * @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch
     */
    commit(tree, dispatch) {
      if (!this.tree) {
        const nodes = tree.children.map((node) => this.create(node, dispatch));
        this.root.replaceChildren(...nodes);
      } else {
        this.patchChildren(this.root, this.tree.children, tree.children, dispatch);
      }
      this.tree = tree;
    }
    /** @param {UINode} node @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch @returns {Node} */
    create(node, dispatch) {
      if (node.type === "text") {
        const dom = this.document.createTextNode(node.value);
        node.dom = dom;
        return dom;
      }
      const element = this.document.createElement(node.tag);
      node.dom = element;
      this.patchElement(null, node, dispatch);
      element.append(...node.children.map((child) => this.create(child, dispatch)));
      return element;
    }
    /**
     * @param {Element} parent @param {UINode[]} oldChildren @param {UINode[]} newChildren
     * @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch
     */
    patchChildren(parent, oldChildren, newChildren, dispatch) {
      const keyed = /* @__PURE__ */ new Map();
      for (const old of oldChildren) if (old.type === "element" && old.key !== null) keyed.set(old.key, old);
      const used = /* @__PURE__ */ new Set();
      const ordered = [];
      for (let index = 0; index < newChildren.length; index++) {
        const next = newChildren[index];
        let previous = next.type === "element" && next.key !== null ? keyed.get(next.key) : oldChildren[index];
        if (previous && used.has(previous)) previous = void 0;
        if (previous && !this.compatible(previous, next)) previous = void 0;
        if (previous) {
          used.add(previous);
          ordered.push(this.patch(previous, next, dispatch));
        } else {
          ordered.push(this.create(next, dispatch));
        }
      }
      for (const old of oldChildren) if (!used.has(old)) this.remove(old);
      for (let index = 0; index < ordered.length; index++) {
        const reference = parent.childNodes[index] || null;
        if (reference !== ordered[index]) parent.insertBefore(ordered[index], reference);
      }
    }
    /** @param {UINode} oldNode @param {UINode} newNode */
    compatible(oldNode, newNode) {
      return oldNode.type === newNode.type && (oldNode.type === "text" || oldNode.tag === /** @type {UIElement} */
      newNode.tag);
    }
    /** @param {UINode} oldNode @param {UINode} newNode @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch @returns {Node} */
    patch(oldNode, newNode, dispatch) {
      if (oldNode.type === "text" && newNode.type === "text") {
        const dom2 = (
          /** @type {Node} */
          oldNode.dom
        );
        if (oldNode.value !== newNode.value) dom2.textContent = newNode.value;
        newNode.dom = dom2;
        return dom2;
      }
      const oldElement = (
        /** @type {UIElement} */
        oldNode
      );
      const newElement = (
        /** @type {UIElement} */
        newNode
      );
      const dom = (
        /** @type {Element} */
        oldElement.dom
      );
      newElement.dom = dom;
      this.patchElement(oldElement, newElement, dispatch);
      this.patchChildren(dom, oldElement.children, newElement.children, dispatch);
      return dom;
    }
    /** @param {UIElement|null} oldNode @param {UIElement} node @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch */
    patchElement(oldNode, node, dispatch) {
      const element = (
        /** @type {HTMLElement} */
        node.dom
      );
      for (const cleanup of oldNode?.cleanups || []) cleanup();
      node.cleanups = [];
      const oldAttrs = oldNode?.attrs || /* @__PURE__ */ Object.create(null);
      for (const name of Object.keys(oldAttrs)) if (!(name in node.attrs)) element.removeAttribute(name);
      for (const [name, raw] of Object.entries(node.attrs)) {
        const lower = name.toLowerCase();
        if (BOOLEAN_ATTRIBUTES.has(lower)) {
          if (perlTrue(raw)) element.setAttribute(name, "");
          else element.removeAttribute(name);
        } else {
          const value = stringValue(raw);
          if (element.getAttribute(name) !== value) element.setAttribute(name, value);
        }
      }
      const actions = /* @__PURE__ */ new Map();
      for (const [event, handler] of Object.entries(node.events)) actions.set(event, { handler, bindings: [] });
      for (const binding of node.bindings) {
        const propertyTarget = (
          /** @type {Record<string,*>} */
          /** @type {*} */
          element
        );
        if (!(binding.property in propertyTarget)) throw new Error(`${node.tag} does not support UI binding property ${binding.property}`);
        const desired = binding.property === "checked" ? perlTrue(binding.value) : stringValue(binding.value);
        if (propertyTarget[binding.property] !== desired) propertyTarget[binding.property] = desired;
        const event = binding.property === "checked" || node.tag === "select" ? "change" : "input";
        const action = actions.get(event) || { handler: null, bindings: [] };
        action.bindings.push(binding);
        actions.set(event, action);
      }
      for (const [event, action] of actions) {
        const listener = (browserEvent) => {
          if (event === "submit") browserEvent.preventDefault();
          const target = (
            /** @type {Record<string,*>} */
            /** @type {*} */
            element
          );
          const updates = action.bindings.map((binding) => (
            /** @type {[string,*]} */
            [binding.variable, target[binding.property]]
          ));
          dispatch(action.handler?.sub || null, action.handler?.args || [], updates);
        };
        element.addEventListener(event, listener);
        node.cleanups.push(() => element.removeEventListener(event, listener));
      }
    }
    /** @param {UINode} node */
    remove(node) {
      this.cleanup(node);
      node.dom?.parentNode?.removeChild(node.dom);
    }
    /** @param {UINode} node */
    cleanup(node) {
      if (node.type === "text") return;
      for (const cleanup of node.cleanups || []) cleanup();
      for (const child of node.children) this.cleanup(child);
    }
    dispose() {
      if (this.tree) for (const child of this.tree.children) this.cleanup(child);
      this.tree = null;
    }
  };

  // src/runtime.js
  var RETURN = /* @__PURE__ */ Symbol("return");
  var truthy = (value) => !(value === "" || value === "0" || value === 0 || value === null || value === void 0 || value === false);
  var perlBoolean = (value) => value ? 1 : "";
  var num = (value) => Number(value) || 0;
  var isReturnSignal = (value) => value?.type === RETURN;
  var SENSITIVE_NAME = /(?:api[_-]?key|secret|token|password|credential|authorization)/i;
  function assertNever(value) {
    throw new Error("Unhandled AST node");
  }
  var Runtime = class {
    /** @param {{io?:MemoryIO,maxIterations?:number,onError?:((error:Error)=>void)|null}} [options] */
    constructor({ io = new MemoryIO(), maxIterations = 1e5, onError = null } = {}) {
      this.io = io;
      this.maxIterations = maxIterations;
      this.onError = onError;
      this.scalars = /* @__PURE__ */ Object.create(null);
      this.arrays = /* @__PURE__ */ Object.create(null);
      this.hashes = /* @__PURE__ */ Object.create(null);
      this.subs = /* @__PURE__ */ new Map();
      this.source = "";
      this.mounts = /* @__PURE__ */ new Map();
      this.uiBuilder = null;
      this.rendering = false;
      this.dirty = false;
      this.callStack = [];
      this.events = [];
      this.observers = /* @__PURE__ */ new Set();
      this.eventSequence = 0;
      this.lastSub = "";
      this.renderCount = 0;
      this.transactionCount = 0;
      this.io.setObserver((event) => this.record(event));
    }
    /** @param {Record<string,*>} event */
    record(event) {
      const entry = { id: ++this.eventSequence, ...event };
      this.events.push(entry);
      if (this.events.length > 200) this.events.shift();
      for (const observer of [...this.observers]) {
        try {
          observer(entry);
        } catch {
        }
      }
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
        events: this.events.map((event) => ({ ...event }))
      };
    }
    /** @param {Record<string,*>} record @returns {Record<string,*>} */
    inspectRecord(record) {
      const copy = /* @__PURE__ */ Object.create(null);
      for (const [name, value] of Object.entries(record)) copy[name] = SENSITIVE_NAME.test(name) && value !== "" ? "[redacted]" : this.inspectValue(value);
      return copy;
    }
    /** @param {*} value @returns {*} */
    inspectValue(value) {
      if (Array.isArray(value)) return value.map((item) => this.inspectValue(item));
      if (value && typeof value === "object") return this.inspectRecord(value);
      return value;
    }
    /** @param {string} source @returns {Runtime} */
    run(source) {
      this.source = source.replace(/\r\n?/g, "\n");
      return this.execute(parse(this.source));
    }
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
        case "expressionStatement":
          return this.eval(node.expression);
        case "sub":
          return this.subs.set(node.name, node);
        case "open":
          return this.io.open(node.handle, this.eval(node.spec));
        case "select":
          return this.io.select(node.handle);
        case "print":
          return this.io.write(node.handle || this.io.selected, node.values.map((v) => this.stringify(this.eval(v))).join(""));
        case "return":
          throw { type: RETURN, value: node.value ? this.eval(node.value) : "" };
        case "modifier":
          if (truthy(this.eval(node.test)) !== node.negate) return this.exec(node.statement);
          return;
        case "if":
          return this.execBlock(truthy(this.eval(node.test)) !== node.negate ? node.consequent : node.alternate);
        case "while": {
          let count = 0;
          while (truthy(this.eval(node.test))) {
            if (++count > this.maxIterations) throw new Error("Maximum loop iterations exceeded");
            this.execBlock(node.body);
          }
          return;
        }
        default:
          return assertNever(node);
      }
    }
    /** @param {import('./types.js').Statement[]} body @returns {void} */
    execBlock(body) {
      for (const statement of body) this.exec(statement);
    }
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
        case "literal":
          return node.value;
        case "string":
          return node.interpolate ? this.interpolate(node.value) : node.value;
        case "regex":
          return { regex: true, pattern: this.interpolate(node.pattern), flags: node.flags };
        case "variable":
          return node.sigil === "@" ? this.arrays[node.name] ||= [] : node.sigil === "%" ? this.hashes[node.name] ||= /* @__PURE__ */ Object.create(null) : this.scalars[node.name] ?? "";
        case "bare":
          return node.name;
        case "arrayLast":
          return (this.arrays[node.name] ||= []).length - 1;
        case "list":
          return node.items.map((item) => this.eval(item));
        case "index":
          return this.indexTarget(node.target)[num(this.eval(node.index))] ?? "";
        case "hashIndex":
          return this.hashTarget(node.target)[this.stringify(this.eval(node.key))] ?? "";
        case "read":
          return this.io.read(node.handle);
        case "assign": {
          const value = this.eval(node.right);
          this.assign(node.left, value);
          return value;
        }
        case "update": {
          const old = num(this.eval(node.argument));
          this.assign(node.argument, old + (node.op === "++" ? 1 : -1));
          return old;
        }
        case "unary":
          return node.op === "!" ? perlBoolean(!truthy(this.eval(node.value))) : -num(this.eval(node.value));
        case "binary":
          return this.binary(node.op, node.left, node.right);
        case "call":
          return this.call(node.name, node.args.map((arg) => this.eval(arg)));
        default:
          return assertNever(node);
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
      if (node.type === "index") {
        this.indexTarget(node.target)[num(this.eval(node.index))] = value;
        this.markDirty();
        return;
      }
      if (node.type === "hashIndex") {
        this.hashTarget(node.target)[this.stringify(this.eval(node.key))] = value;
        this.markDirty();
        return;
      }
      throw new Error("Invalid assignment target");
    }
    /** @param {string} op @param {import('./types.js').Expression} leftNode @param {import('./types.js').Expression} rightNode @returns {*} */
    binary(op, leftNode, rightNode) {
      const left = this.eval(leftNode);
      if (op === "||") return truthy(left) ? left : this.eval(rightNode);
      if (op === "&&") return truthy(left) ? this.eval(rightNode) : left;
      const right = this.eval(rightNode);
      switch (op) {
        case ".":
          return this.stringify(left) + this.stringify(right);
        case "+":
          return num(left) + num(right);
        case "-":
          return num(left) - num(right);
        case "*":
          return num(left) * num(right);
        case "/":
          return num(left) / num(right);
        case "eq":
          return perlBoolean(String(left) === String(right));
        case "ne":
          return perlBoolean(String(left) !== String(right));
        case "lt":
          return perlBoolean(String(left) < String(right));
        case "le":
          return perlBoolean(String(left) <= String(right));
        case "gt":
          return perlBoolean(String(left) > String(right));
        case "ge":
          return perlBoolean(String(left) >= String(right));
        case "==":
          return perlBoolean(num(left) === num(right));
        case "!=":
          return perlBoolean(num(left) !== num(right));
        case "<":
          return perlBoolean(num(left) < num(right));
        case "<=":
          return perlBoolean(num(left) <= num(right));
        case ">":
          return perlBoolean(num(left) > num(right));
        case ">=":
          return perlBoolean(num(left) >= num(right));
        case "=~":
        case "!~": {
          const rx = right?.regex ? new RegExp(right.pattern, right.flags) : new RegExp(String(right));
          const result = rx.exec(String(left));
          if (result) for (let index = 1; index <= 9; index++) this.scalars[String(index)] = result[index] ?? "";
          return perlBoolean(op === "=~" ? Boolean(result) : !result);
        }
        default:
          throw new Error(`Unknown operator ${op}`);
      }
    }
    /** @param {string} name @param {*[]} args @returns {*} */
    call(name, args) {
      if (name === "push") {
        const value = args[0].push(args[1]);
        this.markDirty();
        return value;
      }
      if (name === "pop") {
        const value = args[0].pop() ?? "";
        this.markDirty();
        return value;
      }
      if (name === "shift") {
        const value = args[0].shift() ?? "";
        this.markDirty();
        return value;
      }
      if (name === "keys") return Object.keys(args[0]);
      if (name === "values") return Object.values(args[0]);
      if (name === "localtime") {
        const date = new Date(num(args[0]) * 1e3);
        if (Number.isNaN(date.getTime())) return [];
        const yearStart = new Date(date.getFullYear(), 0, 1);
        const yearDay = Math.floor((date.getTime() - yearStart.getTime()) / 864e5);
        return [date.getSeconds(), date.getMinutes(), date.getHours(), date.getDate(), date.getMonth(), date.getFullYear() - 1900, date.getDay(), yearDay, 0];
      }
      if (name === "encode_json") {
        const value = JSON.stringify(args[0]);
        return value === void 0 ? "" : value;
      }
      if (name === "decode_json") return JSON.parse(this.stringify(args[0]));
      if (name === "json_boolean") return Boolean(truthy(args[0]));
      if (name === "json_get") {
        let value = args[0];
        for (const key of args.slice(1)) {
          if (value === null || value === void 0 || typeof value !== "object") return "";
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
        const sub2 = this.stringify(args[1]);
        if (!this.subs.has(sub2)) throw new Error(`Undefined UI event subroutine ${sub2}`);
        return this.requireUI(name).on(args[0], sub2, args.slice(2));
      }
      if (name === "key") return this.requireUI(name).key(args[0]);
      if (name === "bind") {
        const variable = this.stringify(args[1]).replace(/^\$/, "");
        return this.requireUI(name).bind(args[0], variable, this.scalars[variable] ?? "");
      }
      if (name === "end") return this.requireUI(name).end();
      if (name === "watch") return this.io.watch(args[0], args[1], () => {
        try {
          this.transaction(() => {
            this.call(args[1], []);
          });
        } catch (error) {
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
        try {
          this.execBlock(sub.body);
        } catch (result) {
          if (isReturnSignal(result)) return result.value;
          if (this.rendering && result instanceof PerlScriptRuntimeError && result.uiStack.length === 0) result.uiStack = [...this.callStack];
          throw result;
        }
        return "";
      } finally {
        this.callStack.pop();
        if (previous === void 0) delete this.arrays._;
        else this.arrays._ = previous;
      }
    }
    /** @param {string} value @returns {string} */
    interpolate(value) {
      const unsupportedCapture = value.match(/\$(\d[A-Za-z0-9_]*)/);
      if (unsupportedCapture && !/^[1-9]$/.test(unsupportedCapture[1])) {
        throw new Error(`Capture variables are limited to $1 through $9; got $${unsupportedCapture[1]}`);
      }
      return value.replace(/\$([A-Za-z_]\w*|[1-9])/g, (_match, name) => this.stringify(this.scalars[name] ?? "")).replaceAll(ESCAPED_DOLLAR, "$");
    }
    /** @param {import('./types.js').Expression} node @returns {*[]} */
    indexTarget(node) {
      if (node.type === "variable") return this.arrays[node.name] ||= [];
      return this.eval(node);
    }
    /** @param {import('./types.js').Expression} node @returns {Record<string,*>} */
    hashTarget(node) {
      if (node.type === "variable") return this.hashes[node.name] ||= /* @__PURE__ */ Object.create(null);
      return this.eval(node);
    }
    /** @param {*} value @returns {Record<string,*>} */
    toHash(value) {
      if (!Array.isArray(value)) {
        if (value && typeof value === "object") return value;
        throw new Error("Hash assignment requires a list of key/value pairs");
      }
      if (value.length % 2 !== 0) throw new Error("Hash assignment requires an even number of values");
      const hash = /* @__PURE__ */ Object.create(null);
      for (let index = 0; index < value.length; index += 2) hash[this.stringify(value[index])] = value[index + 1];
      return hash;
    }
    /** @param {*} value @returns {string} */
    stringify(value) {
      return value === null || value === void 0 ? "" : Array.isArray(value) ? value.map((item) => this.stringify(item)).join("") : String(value);
    }
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
    markDirty() {
      if (!this.rendering && this.mounts.size) this.dirty = true;
    }
    flushUI() {
      if (!this.dirty || !this.mounts.size || this.rendering) return;
      const candidates = [];
      this.dirty = false;
      for (const [handle, view] of this.mounts) {
        const state = this.snapshot();
        const builder = new UITreeBuilder();
        this.uiBuilder = builder;
        this.rendering = true;
        try {
          this.call(view, []);
          try {
            candidates.push([handle, builder.finish()]);
          } catch (error) {
            if (error instanceof PerlScriptRuntimeError) throw error;
            const cause = error instanceof Error ? error : new Error(String(error));
            throw new PerlScriptRuntimeError(cause.message, { source: this.source, range: this.subs.get(view)?.range, cause, uiStack: [view] });
          }
        } finally {
          this.restore(state);
          this.rendering = false;
          this.uiBuilder = null;
        }
      }
      for (const [handle, tree] of candidates) {
        this.io.commitUI(
          handle,
          tree,
          (sub, args, updates) => this.dispatchUI(sub, args, updates)
        );
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
      } catch (error) {
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
      try {
        action();
        this.flushUI();
        this.record({ kind: "runtime", action: "transaction", phase: "commit", transaction });
      } catch (error) {
        this.restore(state);
        this.dirty = this.mounts.size > 0;
        try {
          this.flushUI();
        } catch {
        }
        this.dirty = wasDirty;
        this.record({ kind: "runtime", action: "transaction", phase: "rollback", transaction });
        throw error;
      }
    }
    snapshot() {
      return { scalars: this.cloneRecord(this.scalars), arrays: this.cloneRecord(this.arrays), hashes: this.cloneRecord(this.hashes) };
    }
    /** @param {{scalars:Record<string,*>,arrays:Record<string,*>,hashes:Record<string,*>}} state */
    restore(state) {
      this.scalars = state.scalars;
      this.arrays = state.arrays;
      this.hashes = state.hashes;
    }
    /** @param {Record<string,*>} record */
    cloneRecord(record) {
      const copy = /* @__PURE__ */ Object.create(null);
      for (const [key, value] of Object.entries(record)) copy[key] = this.cloneValue(value);
      return copy;
    }
    /** @param {*} value @returns {*} */
    cloneValue(value) {
      if (Array.isArray(value)) return value.map((item) => this.cloneValue(item));
      if (value && typeof value === "object") return this.cloneRecord(value);
      return value;
    }
    dispose() {
      this.record({ kind: "runtime", action: "dispose" });
      this.io.dispose();
      this.observers.clear();
    }
  };

  // src/browser-io.js
  var memoryStorage = () => {
    const values = /* @__PURE__ */ new Map();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key)
    };
  };
  var fallbackStorage = { local: memoryStorage(), session: memoryStorage() };
  function resolveStorage(document2, kind, override) {
    if (override) return override;
    try {
      const property = `${kind}Storage`;
      const view = (
        /** @type {*} */
        document2.defaultView
      );
      const root = (
        /** @type {*} */
        globalThis
      );
      return view?.[property] || root[property] || fallbackStorage[kind];
    } catch {
      return fallbackStorage[kind];
    }
  }
  function resolveNavigation(document2, override) {
    if (override) return override;
    const view = (
      /** @type {*} */
      document2.defaultView || globalThis.window
    );
    if (!view?.location || !view?.history || typeof view.addEventListener !== "function") return null;
    return view;
  }
  function resolveClock(override) {
    return {
      now: override?.now || Date.now,
      setInterval: override?.setInterval || globalThis.setInterval.bind(globalThis),
      clearInterval: override?.clearInterval || globalThis.clearInterval.bind(globalThis)
    };
  }
  function currentRoute(navigation, mode) {
    if (mode === "hash") return String(navigation.location.hash || "").replace(/^#/, "") || "/";
    return `${navigation.location.pathname || "/"}${navigation.location.search || ""}${navigation.location.hash || ""}`;
  }
  function validateRoute(route) {
    if (!route.startsWith("/") || route.startsWith("//") || /[\r\n]/.test(route)) throw new Error(`Invalid route ${route || "(empty)"}`);
  }
  var BrowserIO = class extends MemoryIO {
    /**
     * @param {Document} document
     * @param {{streams?:Map<string,Function>|Record<string,Function>,storage?:{local?:*,session?:*},navigation?:*,clock?:{now?:()=>number,setInterval?:(callback:Function,interval:number)=>*,clearInterval?:(timer:*)=>void}}} [options]
     */
    constructor(document2, options = {}) {
      super();
      this.document = document2;
      this.streams = options.streams instanceof Map ? options.streams : new Map(Object.entries(options.streams || {}));
      this.storage = {
        local: resolveStorage(document2, "local", options.storage?.local),
        session: resolveStorage(document2, "session", options.storage?.session)
      };
      this.navigation = resolveNavigation(document2, options.navigation);
      this.clock = resolveClock(options.clock);
      this.styles = /* @__PURE__ */ new Map();
      this.effects = null;
    }
    beginEffects() {
      if (this.effects) throw new Error("Browser I/O effects are already staged");
      this.effects = { storage: /* @__PURE__ */ new Map(), routes: [], routeValues: /* @__PURE__ */ new Map() };
    }
    commitEffects() {
      const effects = this.effects;
      if (!effects) return;
      this.effects = null;
      try {
        for (const [area, entries] of effects.storage) {
          for (const [key, entry] of entries) {
            if (entry.value === null) area.removeItem(key);
            else area.setItem(key, entry.value);
          }
        }
        for (const { navigation, mode, route } of effects.routes) {
          if (mode === "hash") navigation.location.hash = `#${route}`;
          else navigation.history.pushState(null, "", route);
        }
      } catch (error) {
        for (const [area, entries] of effects.storage) {
          for (const [key, entry] of entries) {
            try {
              if (entry.original === null) area.removeItem(key);
              else area.setItem(key, entry.original);
            } catch {
            }
          }
        }
        throw error;
      }
    }
    rollbackEffects() {
      this.effects = null;
    }
    /** @param {*} area @param {string} key */
    storageValue(area, key) {
      const staged = this.effects?.storage.get(area)?.get(key);
      return staged ? staged.value : area.getItem(key);
    }
    /** @param {*} area @param {string} key @param {string|null} value */
    setStorageValue(area, key, value) {
      if (!this.effects) {
        if (value === null) area.removeItem(key);
        else area.setItem(key, value);
        return;
      }
      let entries = this.effects.storage.get(area);
      if (!entries) {
        entries = /* @__PURE__ */ new Map();
        this.effects.storage.set(area, entries);
      }
      const existing = entries.get(key);
      entries.set(key, { original: existing?.original ?? area.getItem(key), value });
    }
    /** @param {'hash'|'history'} mode */
    routeValue(mode) {
      return this.effects?.routeValues.get(mode) ?? currentRoute(this.navigation, mode);
    }
    /** @param {'hash'|'history'} mode @param {string} value */
    publishRoute(mode, value) {
      for (const [name, candidate] of this.handles) {
        if (candidate.type !== "route" || candidate.mode !== mode || candidate.value === value) continue;
        candidate.value = value;
        this.observe({ kind: "io", action: "change", handle: name });
        for (const callback of [...candidate.watchers]) callback();
      }
    }
    /** @param {string} name @param {*} spec */
    open(name, spec) {
      const value = String(spec);
      const append = value.startsWith(">>");
      const output = value.startsWith(">");
      const body = output ? value.slice(append ? 2 : 1) : value;
      let type;
      let event;
      let selector;
      if (body.startsWith("css:")) {
        const sheetName = body.slice(4);
        if (!output || !/^[A-Za-z0-9._-]+$/.test(sheetName)) throw new Error(`Invalid browser filehandle spec ${value}`);
        let sheet = this.styles.get(sheetName);
        if (!sheet) {
          const element2 = this.document.createElement("style");
          element2.setAttribute("data-perlscript-css", sheetName);
          const parent = this.document.head || this.document.querySelector("head") || this.document.documentElement;
          if (!parent || typeof parent.append !== "function") throw new Error("Document cannot host a CSS filehandle");
          parent.append(element2);
          sheet = { element: element2, value: "" };
          this.styles.set(sheetName, sheet);
        }
        if (!append) {
          sheet.value = "";
          sheet.element.textContent = "";
        }
        if (this.handles.has(name)) this.close(name);
        this.handles.set(name, { type: "css", sheet });
        this.observe({ kind: "io", action: "open", handle: name, target: value });
        return;
      } else if (append) {
        throw new Error(`Invalid browser filehandle spec ${value}`);
      } else if (body.startsWith("route:")) {
        if (output || !/^route:(hash|history)$/.test(body)) throw new Error(`Invalid browser filehandle spec ${value}`);
        if (!this.navigation) throw new Error("Route filehandles require a browser navigation object");
        if (this.handles.has(name)) this.close(name);
        const mode = (
          /** @type {'hash'|'history'} */
          body.slice(6)
        );
        const navigation = this.navigation;
        const handle = { type: "route", mode, navigation, value: this.routeValue(mode), watchers: /* @__PURE__ */ new Set(), removeListener: null };
        this.handles.set(name, handle);
        this.observe({ kind: "io", action: "open", handle: name, target: value });
        return;
      } else if (body.startsWith("clock:")) {
        if (output || !/^clock:[0-9]+$/.test(body)) throw new Error(`Invalid browser filehandle spec ${value}`);
        const interval = Number(body.slice(6));
        if (!Number.isSafeInteger(interval) || interval < 16 || interval > 864e5) throw new Error(`Invalid clock interval ${interval}`);
        if (this.handles.has(name)) this.close(name);
        this.handles.set(name, { type: "clock", interval, clock: this.clock, watchers: /* @__PURE__ */ new Set(), timer: null });
        this.observe({ kind: "io", action: "open", handle: name, target: value });
        return;
      } else if (body.startsWith("storage:")) {
        const match = /^storage:(local|session):(.+)$/.exec(body);
        if (!match) throw new Error(`Invalid browser filehandle spec ${value}`);
        const kind = (
          /** @type {'local'|'session'} */
          match[1]
        );
        const area = this.storage[kind];
        const key = match[2];
        if (this.handles.has(name)) this.close(name);
        if (output) this.setStorageValue(area, key, null);
        this.handles.set(name, { type: "storage", area, key, writable: output, value: "" });
        this.observe({ kind: "io", action: "open", handle: name, target: value });
        return;
      } else if (body.startsWith("stream:")) {
        if (output) throw new Error(`Stream filehandle is bidirectional: ${value}`);
        const streamName = body.slice(7);
        const factory = this.streams.get(streamName);
        if (!streamName || !factory) throw new Error(`Unknown browser stream ${streamName || value}`);
        if (this.handles.has(name)) this.close(name);
        const handle = {
          type: "stream",
          name: streamName,
          adapter: { write() {
          } },
          queue: [],
          watchers: /* @__PURE__ */ new Set(),
          ended: true,
          closed: false
        };
        const notify = () => {
          for (const callback of [...handle.watchers]) callback();
        };
        const adapter = factory({
          emit: (value2) => {
            if (!handle.closed) {
              handle.queue.push(String(value2));
              notify();
            }
          },
          end: () => {
            if (!handle.closed) {
              handle.ended = true;
              notify();
            }
          }
        });
        if (!adapter || typeof adapter.write !== "function") throw new Error(`Browser stream ${streamName} must provide write()`);
        handle.adapter = adapter;
        this.handles.set(name, handle);
        this.observe({ kind: "io", action: "open", handle: name, target: value });
        return;
      } else if (body.startsWith("ui:")) {
        if (!output) throw new Error(`UI filehandle must be writable: ${value}`);
        selector = body.slice(3);
        if (!selector) throw new Error(`Invalid browser filehandle spec ${value}`);
        const element2 = this.document.querySelector(selector);
        if (!element2) throw new Error(`No element matches ${selector}`);
        if (this.handles.has(name)) this.close(name);
        this.handles.set(name, { type: "ui", element: element2, renderer: new DOMUIRenderer(this.document, element2) });
        this.observe({ kind: "io", action: "open", handle: name, target: value });
        return;
      } else if (body.startsWith("dom:")) {
        type = "dom";
        selector = body.slice(4);
      } else if (body.startsWith("event:")) {
        type = "event";
        const separator = body.indexOf(":", 6);
        if (separator !== -1) {
          event = body.slice(6, separator);
          selector = body.slice(separator + 1);
        }
      } else {
        return super.open(name, spec);
      }
      if (!selector || type === "event" && (!event || output)) {
        throw new Error(`Invalid browser filehandle spec ${value}`);
      }
      const element = this.document.querySelector(selector);
      if (!element) throw new Error(`No element matches ${selector}`);
      if (this.handles.has(name)) this.close(name);
      this.handles.set(name, type === "event" ? { type: "event", element, event: event || "", cleanups: /* @__PURE__ */ new Set() } : { type: output ? "dom-out" : "dom-in", element });
      this.observe({ kind: "io", action: "open", handle: name, target: value });
    }
    /** @param {string} name */
    read(name) {
      const handle = this.require(name);
      if (handle.type === "route") {
        const value = this.routeValue(handle.mode);
        handle.value = value;
        this.observe({ kind: "io", action: "read", handle: name, bytes: value.length });
        return value;
      }
      if (handle.type === "clock") {
        const value = String(Math.floor(handle.clock.now() / 1e3));
        this.observe({ kind: "io", action: "read", handle: name, bytes: value.length });
        return value;
      }
      if (handle.type === "storage") {
        const value = String(this.storageValue(handle.area, handle.key) ?? "");
        this.observe({ kind: "io", action: "read", handle: name, bytes: value.length });
        return value;
      }
      if (handle.type === "stream") {
        const value = handle.queue.shift() ?? "";
        this.observe({ kind: "io", action: "read", handle: name, bytes: value.length });
        return value;
      }
      if (handle.type === "dom-in") {
        const value = String("value" in handle.element ? handle.element.value : handle.element.textContent || "");
        this.observe({ kind: "io", action: "read", handle: name, bytes: value.length });
        return value;
      }
      return super.read(name);
    }
    /** @param {string} name @param {*} value */
    write(name, value) {
      const handle = this.require(name);
      const bytes = String(value).length;
      if (handle.type === "route") {
        const route = String(value);
        validateRoute(route);
        if (this.effects) {
          this.effects.routes.push({ navigation: handle.navigation, mode: handle.mode, route });
          this.effects.routeValues.set(handle.mode, route);
        } else {
          if (handle.mode === "hash") handle.navigation.location.hash = `#${route}`;
          else handle.navigation.history.pushState(null, "", route);
        }
        this.publishRoute(handle.mode, route);
        this.observe({ kind: "io", action: "write", handle: name, bytes });
        return;
      }
      if (handle.type === "clock") throw new Error(`${name} is a read-only clock filehandle`);
      if (handle.type === "storage") {
        if (!handle.writable) throw new Error(`${name} is a read-only storage filehandle`);
        handle.value += String(value);
        this.setStorageValue(handle.area, handle.key, handle.value);
        this.observe({ kind: "io", action: "write", handle: name, bytes });
        return;
      }
      if (handle.type === "css") {
        handle.sheet.value += String(value);
        handle.sheet.element.textContent = handle.sheet.value;
        this.observe({ kind: "io", action: "write", handle: name, bytes });
        return;
      }
      if (handle.type === "stream") {
        if (handle.closed) throw new Error(`${name} is a closed stream filehandle`);
        handle.ended = false;
        this.observe({ kind: "io", action: "write", handle: name, bytes });
        return handle.adapter.write(String(value));
      }
      if (handle.type === "dom-in") {
        if ("value" in handle.element) handle.element.value = String(value);
        else handle.element.textContent = String(value);
        this.observe({ kind: "io", action: "write", handle: name, bytes });
        return;
      }
      if (handle.type === "dom-out") {
        if (typeof handle.element.append === "function") {
          const text = this.document.createTextNode?.(String(value)) ?? String(value);
          handle.element.append(text);
        } else {
          handle.element.textContent = (handle.element.textContent || "") + value;
        }
        this.observe({ kind: "io", action: "write", handle: name, bytes });
        return;
      }
      super.write(name, value);
    }
    /** @param {string} [name] */
    clear(name = this.selected) {
      const handle = this.require(name);
      if (handle.type === "storage") {
        handle.value = "";
        this.setStorageValue(handle.area, handle.key, null);
        this.observe({ kind: "io", action: "clear", handle: name });
        return;
      }
      if (handle.type === "css") {
        handle.sheet.value = "";
        handle.sheet.element.textContent = "";
        this.observe({ kind: "io", action: "clear", handle: name });
        return;
      }
      if (handle.type === "dom-out" || handle.type === "dom-in") {
        if ("value" in handle.element && handle.type === "dom-in") handle.element.value = "";
        else handle.element.textContent = "";
        this.observe({ kind: "io", action: "clear", handle: name });
        return;
      }
      super.clear(name);
    }
    /** @param {string} handleName @param {string} subName @param {Function} callback */
    watch(handleName, subName, callback) {
      const handle = this.require(handleName);
      if (handle.type === "route") {
        handle.watchers.add(callback);
        if (!handle.removeListener) {
          const event = handle.mode === "hash" ? "hashchange" : "popstate";
          const listener2 = () => {
            const next = currentRoute(handle.navigation, handle.mode);
            this.publishRoute(handle.mode, next);
          };
          handle.navigation.addEventListener(event, listener2);
          handle.removeListener = () => handle.navigation.removeEventListener(event, listener2);
        }
        this.observe({ kind: "io", action: "watch", handle: handleName, sub: subName });
        return;
      }
      if (handle.type === "clock") {
        handle.watchers.add(callback);
        if (handle.timer === null) handle.timer = handle.clock.setInterval(() => {
          this.observe({ kind: "io", action: "tick", handle: handleName });
          for (const watcher of [...handle.watchers]) watcher();
        }, handle.interval);
        this.observe({ kind: "io", action: "watch", handle: handleName, sub: subName });
        return;
      }
      if (handle.type === "stream") {
        handle.watchers.add(callback);
        this.observe({ kind: "io", action: "watch", handle: handleName, sub: subName });
        return;
      }
      if (handle.type !== "event") throw new Error(`${handleName} is not a watchable filehandle`);
      const listener = (event) => {
        const keyboard = (
          /** @type {KeyboardEvent} */
          event
        );
        if (handle.event === "keydown" && (keyboard.key !== "Enter" || keyboard.isComposing || keyboard.keyCode === 229)) return;
        callback(event, subName);
      };
      handle.element.addEventListener(handle.event, listener);
      handle.cleanups.add(() => handle.element.removeEventListener(handle.event, listener));
      this.observe({ kind: "io", action: "watch", handle: handleName, sub: subName });
    }
    /** @param {string} name */
    eof(name) {
      const handle = this.require(name);
      if (handle.type !== "stream") return super.eof(name);
      return handle.ended && handle.queue.length === 0 ? 1 : "";
    }
    /** @param {string} name */
    close(name) {
      const handle = this.require(name);
      if (handle.type === "route") {
        handle.watchers.clear();
        handle.removeListener?.();
        handle.removeListener = null;
      }
      if (handle.type === "clock") {
        handle.watchers.clear();
        if (handle.timer !== null) handle.clock.clearInterval(handle.timer);
        handle.timer = null;
      }
      if (handle.type === "stream" && !handle.closed) {
        handle.closed = true;
        handle.ended = true;
        handle.queue.length = 0;
        handle.watchers.clear();
        handle.adapter?.close?.();
      }
      if (handle.type === "event") {
        for (const cleanup of handle.cleanups) cleanup();
        handle.cleanups.clear();
      }
      if (handle.type === "ui") handle.renderer.dispose();
      this.handles.delete(name);
      this.observe({ kind: "io", action: "close", handle: name });
    }
    /** @param {string} name */
    validateUI(name) {
      const handle = this.require(name);
      if (handle.type !== "ui") throw new Error(`${name} is not a UI filehandle`);
    }
    /** @param {string} name @param {import('./ui.js').UITreeBuilder['root']} tree @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch */
    commitUI(name, tree, dispatch) {
      this.validateUI(name);
      const handle = this.require(name);
      if (handle.type !== "ui") return;
      handle.renderer.commit(tree, dispatch);
      this.observe({ kind: "io", action: "commit", handle: name });
    }
    dispose() {
      this.rollbackEffects();
      for (const [name] of [...this.handles]) if (name !== "STDOUT") this.close(name);
      for (const { element } of this.styles.values()) {
        if (typeof element.remove === "function") element.remove();
        else element.parentNode?.removeChild(element);
      }
      this.styles.clear();
    }
  };

  // src/browser.js
  var active = /* @__PURE__ */ new WeakMap();
  var generations = /* @__PURE__ */ new WeakMap();
  var nextGeneration = 0;
  var defaultErrorHandler = null;
  var streamRegistrations = /* @__PURE__ */ new Map();
  function currentStreamFactories() {
    return new Map([...streamRegistrations].flatMap(([name, entries]) => {
      const current = entries.at(-1);
      return current ? [[name, current.factory]] : [];
    }));
  }
  function registerStream(name, factory) {
    if (!name || name.includes(":")) throw new TypeError("Stream name must be a non-empty name without colons");
    if (typeof factory !== "function") throw new TypeError("Stream factory must be a function");
    const entry = { factory };
    const entries = streamRegistrations.get(name) || [];
    entries.push(entry);
    streamRegistrations.set(name, entries);
    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      const current = streamRegistrations.get(name);
      if (!current) return;
      const index = current.indexOf(entry);
      if (index !== -1) current.splice(index, 1);
      if (current.length === 0) streamRegistrations.delete(name);
    };
  }
  function setErrorHandler(handler) {
    if (handler !== null && typeof handler !== "function") throw new TypeError("Error handler must be a function or null");
    defaultErrorHandler = handler;
  }
  function hasErrorHandler() {
    return defaultErrorHandler !== null;
  }
  function report(error, handler) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    handler?.(normalized);
  }
  function run(source, options = {}) {
    const document2 = options.document || globalThis.document;
    if (!document2) throw new Error("PerlScript.run requires a document");
    const onError = options.onError === void 0 ? defaultErrorHandler : options.onError;
    const runtime = new Runtime({ io: options.io || new BrowserIO(document2, { streams: currentStreamFactories() }), onError });
    try {
      runtime.run(source);
    } catch (error) {
      runtime.dispose();
      report(error, onError);
      throw error;
    }
    return runtime;
  }
  async function runScripts(root = globalThis.document, options = {}) {
    if (!root) return [];
    const scripts = (
      /** @type {HTMLScriptElement[]} */
      [...root.querySelectorAll('script[type="text/perl"]')]
    );
    const runtimes = [];
    const generation = ++nextGeneration;
    for (const script of scripts) {
      if ((generations.get(script) || 0) > generation) continue;
      generations.set(script, generation);
      let source;
      try {
        source = script.src ? await fetch(script.src).then((response) => {
          if (!response.ok) throw new Error(`Unable to load ${script.src}: ${response.status}`);
          return response.text();
        }) : script.textContent;
      } catch (error) {
        if (generations.get(script) !== generation) continue;
        report(error, options.onError === void 0 ? defaultErrorHandler : options.onError);
        throw error;
      }
      if (generations.get(script) !== generation) continue;
      const document2 = script.ownerDocument || root;
      const io = new BrowserIO(document2, { streams: currentStreamFactories() });
      io.beginEffects();
      let runtime;
      try {
        runtime = run(source, { document: document2, io, onError: options.onError });
      } catch (error) {
        io.rollbackEffects();
        throw error;
      }
      if (generations.get(script) !== generation) {
        runtime.dispose();
        io.rollbackEffects();
        continue;
      }
      try {
        io.commitEffects();
      } catch (error) {
        runtime.dispose();
        report(error, options.onError === void 0 ? defaultErrorHandler : options.onError);
        throw error;
      }
      const previous = active.get(script);
      active.set(script, runtime);
      previous?.dispose();
      runtimes.push(runtime);
    }
    return runtimes;
  }
  function disposeScript(script) {
    generations.set(script, ++nextGeneration);
    active.get(script)?.dispose();
    active.delete(script);
  }

  // src/web-adapters.js
  var memoryStorage2 = () => {
    const values = /* @__PURE__ */ new Map();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key)
    };
  };
  function resolveStorage2(override) {
    if (override) return override;
    try {
      return globalThis.localStorage || memoryStorage2();
    } catch {
      return memoryStorage2();
    }
  }
  async function emitSSE(response, emit) {
    if (!response.body) throw new Error("Streaming response body is unavailable.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const dispatch = (block) => {
      const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
      if (data && data !== "[DONE]") emit(data);
    };
    for (; ; ) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      let boundary = buffer.match(/\r?\n\r?\n/);
      while (boundary && boundary.index !== void 0) {
        dispatch(buffer.slice(0, boundary.index));
        buffer = buffer.slice(boundary.index + boundary[0].length);
        boundary = buffer.match(/\r?\n\r?\n/);
      }
      if (done) break;
    }
    if (buffer.trim()) dispatch(buffer);
  }
  function createWebAdapters(options = {}) {
    const storage = resolveStorage2(options.storage);
    const fetcher = options.fetch || globalThis.fetch?.bind(globalThis);
    const secretPrefix = options.secretPrefix || "perlscript-web:secret:";
    const secrets = /* @__PURE__ */ new Map();
    const secretKey = (name) => `${secretPrefix}${name}`;
    const readStored = (name) => {
      try {
        return String(storage.getItem(secretKey(name)) || "");
      } catch {
        return "";
      }
    };
    const writeStored = (name, value) => {
      try {
        if (value) storage.setItem(secretKey(name), value);
        else storage.removeItem(secretKey(name));
      } catch {
      }
    };
    const resolveSecret = (name) => {
      const value = secrets.get(name) || readStored(name);
      if (value) secrets.set(name, value);
      return value;
    };
    const secret = ({ emit, end }) => ({
      write(raw) {
        try {
          const command = JSON.parse(raw);
          const name = String(command.name || "");
          if (!name) throw new Error("Secret command requires a name.");
          if (command.op === "set") {
            const value = String(command.value || "");
            if (!value) throw new Error("Secret value cannot be empty.");
            secrets.set(name, value);
            writeStored(name, command.persist ? value : "");
          } else if (command.op === "persist") {
            const value = resolveSecret(name);
            writeStored(name, command.persist && value ? value : "");
          } else if (command.op === "delete") {
            secrets.delete(name);
            writeStored(name, "");
          } else if (command.op !== "status") {
            throw new Error(`Unknown secret operation ${command.op || "(empty)"}.`);
          }
          emit(JSON.stringify({ type: "secret.result", op: command.op, name, configured: Boolean(resolveSecret(name)), persisted: Boolean(readStored(name)) }));
        } catch (error) {
          emit(JSON.stringify({ type: "secret.error", message: error instanceof Error ? error.message : String(error) }));
        } finally {
          end();
        }
      }
    });
    const http = ({ emit, end }) => {
      let controller = null;
      return {
        write(raw) {
          controller?.abort();
          const current = new AbortController();
          controller = current;
          void (async () => {
            if (!fetcher) throw new Error("Fetch is unavailable in this browser.");
            const request = JSON.parse(raw);
            if (!/^https:\/\//.test(request.url || "")) throw new Error("HTTP stream requires an HTTPS URL.");
            const headers = new Headers(request.headers || {});
            const credential = request.bearer || (request.credential ? resolveSecret(String(request.credential)) : "");
            if (request.credential && !credential) {
              emit(JSON.stringify({ type: "http.error", code: "credential_missing", message: `Credential ${request.credential} is not configured.` }));
              return;
            }
            if (credential) headers.set("Authorization", `Bearer ${credential}`);
            let body;
            if (request.body !== void 0) {
              body = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
              if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
            }
            const response = await fetcher(request.url, { method: request.method || "GET", headers, body, signal: current.signal });
            if (!response.ok) {
              let message = `${response.status} ${response.statusText || ""}`.trim();
              try {
                message = (await response.json()).error?.message || message;
              } catch {
              }
              emit(JSON.stringify({ type: "http.error", status: response.status, message }));
              return;
            }
            if (request.stream === "sse") await emitSSE(response, emit);
            else emit(JSON.stringify({ type: "http.response", status: response.status, body: await response.text() }));
          })().catch((error) => {
            if (error?.name !== "AbortError") emit(JSON.stringify({ type: "http.error", message: error instanceof Error ? error.message : String(error) }));
          }).finally(() => {
            if (controller === current) {
              controller = null;
              end();
            }
          });
        },
        close() {
          controller?.abort();
          controller = null;
        }
      };
    };
    return {
      secret,
      http
    };
  }
  function installWebAdapters(options = {}) {
    const adapters = createWebAdapters(options);
    const unregisterSecret = registerStream("secret", adapters.secret);
    const unregisterHTTP = registerStream("http", adapters.http);
    return () => {
      unregisterHTTP();
      unregisterSecret();
    };
  }

  // src/image-adapter.js
  var DEFAULT_MAX_INPUT_BYTES = 10 * 1024 * 1024;
  var DEFAULT_MAX_OUTPUT_BYTES = 250 * 1024;
  function dataURLBytes(dataURL) {
    const encoded = dataURL.split(",", 2)[1] || "";
    return Math.ceil(encoded.length * 3 / 4);
  }
  async function processImageUpload(file, options = {}) {
    const document2 = options.document || globalThis.document;
    const decode = options.createImageBitmap || globalThis.createImageBitmap?.bind(globalThis);
    if (!document2 || !decode) throw new Error("Image processing is unavailable in this browser.");
    const size = Math.max(32, Math.min(2048, Number(options.size) || 512));
    const maxOutputBytes = Math.max(16 * 1024, Number(options.maxOutputBytes) || DEFAULT_MAX_OUTPUT_BYTES);
    const bitmap = await decode(file);
    try {
      if (!bitmap.width || !bitmap.height) throw new Error("The selected image has no visible pixels.");
      const contain = options.fit === "contain";
      const sourceSize = Math.min(bitmap.width, bitmap.height);
      const sourceX = contain ? 0 : (bitmap.width - sourceSize) / 2;
      const sourceY = contain ? 0 : (bitmap.height - sourceSize) / 2;
      const sourceWidth = contain ? bitmap.width : sourceSize;
      const sourceHeight = contain ? bitmap.height : sourceSize;
      const scale = contain ? Math.min(1, size / Math.max(bitmap.width, bitmap.height)) : 1;
      const outputWidth = contain ? Math.max(1, Math.round(bitmap.width * scale)) : size;
      const outputHeight = contain ? Math.max(1, Math.round(bitmap.height * scale)) : size;
      const canvas = document2.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas image processing is unavailable.");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, outputWidth, outputHeight);
      context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
      let quality = Math.max(0.4, Math.min(0.95, Number(options.quality) || 0.82));
      let mime = "image/webp";
      let dataURL = canvas.toDataURL(mime, quality);
      if (!dataURL.startsWith("data:image/webp;base64,")) {
        mime = "image/jpeg";
        dataURL = canvas.toDataURL(mime, quality);
      }
      while (dataURLBytes(dataURL) > maxOutputBytes && quality > 0.4) {
        quality = Math.max(0.4, quality - 0.1);
        dataURL = canvas.toDataURL(mime, quality);
      }
      if (!dataURL.startsWith(`data:${mime};base64,`)) throw new Error("Image encoding is unavailable in this browser.");
      if (dataURLBytes(dataURL) > maxOutputBytes) throw new Error("The processed image is still too large to store.");
      return { data: dataURL, width: outputWidth, height: outputHeight, bytes: dataURLBytes(dataURL), mime };
    } finally {
      bitmap.close?.();
    }
  }
  function createImageAdapter(options = {}) {
    const document2 = options.document || globalThis.document;
    const processImage = options.processImage || ((file, command) => processImageUpload(file, { ...command, document: document2 }));
    const defaultMaxInputBytes = Number(options.maxInputBytes) || DEFAULT_MAX_INPUT_BYTES;
    return ({ emit, end }) => {
      let closed = false;
      return {
        write(raw) {
          let command = {};
          void (async () => {
            command = JSON.parse(raw);
            const selector = String(command.selector || "");
            if (!selector) throw new Error("Image command requires an input selector.");
            const input = (
              /** @type {HTMLInputElement|null|undefined} */
              document2?.querySelector(selector)
            );
            const file = input?.files?.[0];
            if (!file) throw new Error("\u5199\u771F\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
            if (!/^image\/(jpeg|png|webp|gif)$/i.test(String(file.type || ""))) throw new Error("JPEG\u3001PNG\u3001WebP\u3001GIF\u753B\u50CF\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
            const maxInputBytes = Number(command.maxInputBytes) || defaultMaxInputBytes;
            if (file.size > maxInputBytes) throw new Error("\u753B\u50CF\u30D5\u30A1\u30A4\u30EB\u304C\u5927\u304D\u3059\u304E\u307E\u3059\u3002");
            const result = await processImage(file, command);
            if (!closed) emit(JSON.stringify({ type: "image.result", id: String(command.id || ""), name: String(file.name || "image"), ...result }));
          })().catch((error) => {
            if (!closed) emit(JSON.stringify({ type: "image.error", id: String(command.id || ""), message: error instanceof Error ? error.message : String(error) }));
          }).finally(() => {
            if (!closed) end();
          });
        },
        close() {
          closed = true;
        }
      };
    };
  }
  function installImageAdapter(options = {}) {
    return registerStream("image", createImageAdapter(options));
  }

  // src/auto.js
  if (typeof document !== "undefined") {
    const start = () => runScripts().catch((error) => {
      if (!hasErrorHandler()) setTimeout(() => {
        throw error;
      });
    });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else queueMicrotask(start);
  }
  return __toCommonJS(auto_exports);
})();
//# sourceMappingURL=perlscript-web.js.map
