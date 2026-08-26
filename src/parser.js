import { tokenize } from "./lexer.js";
import { PerlScriptSyntaxError } from "./errors.js";

/** @type {Record<string, number>} */
const PRECEDENCE = { "||": 1, "&&": 2, eq: 3, ne: 3, lt: 3, le: 3, gt: 3, ge: 3, "==": 3, "!=": 3, "<": 3, ">": 3, "<=": 3, ">=": 3, "=~": 3, "!~": 3, ".": 4, "+": 5, "-": 5, "*": 6, "/": 6 };

/** @param {{range:import('./types.js').SourceRange}} start @param {{range:import('./types.js').SourceRange}} end @returns {import('./types.js').SourceRange} */
const rangeFrom = (start, end) => ({ start: start.range.start, end: end.range.end });

export class Parser {
  /** @param {string} source */
  constructor(source) {
    this.source = source.replace(/\r\n?/g, "\n");
    this.tokens = tokenize(this.source);
    this.index = 0;
  }

  /** @returns {import('./types.js').Token} */
  peek(n = 0) { return this.tokens[this.index + n] || this.tokens.at(-1); }
  /** @returns {import('./types.js').Token} */
  take() { return this.tokens[this.index++] || this.tokens.at(-1); }
  /** @param {string} value */
  is(value) { return this.peek().value === value; }

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
    /** @type {import('./types.js').Statement[]} */
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
    /** @type {import('./types.js').Statement[]} */
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
    /** @type {import('./types.js').Statement[]} */
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
    const value = (this.is(";") || this.is("if") || this.is("unless")) ? null : this.expression();
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
    /** @type {import('./types.js').Expression[]} */
    const values = [];
    if (!this.is(";")) {
      values.push(this.expression());
      while (this.is(",")) { this.take(); values.push(this.expression()); }
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
      const node = { type: /** @type {'variable'} */ ("variable"), sigil: token.sigil || "", name: token.value, range: token.range };
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
        const close = this.take();
        return { type: "list", items: [], range: rangeFrom(token, close) };
      }
      const first = this.expression();
      if (this.is(",")) {
        /** @type {import('./types.js').Expression[]} */
        const items = [first];
        while (this.is(",")) {
          this.take();
          if (this.is(")")) break;
          items.push(this.expression());
        }
        const close = this.expect(")");
        return { type: "list", items, range: rangeFrom(token, close) };
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
    /** @type {import('./types.js').Expression[]} */
    const args = [];
    if (!this.is(")")) {
      args.push(this.expression());
      while (this.is(",")) { this.take(); args.push(this.expression()); }
    }
    return { args, close: this.expect(")") };
  }

  /** @param {string} message @param {import('./types.js').Token} token */
  error(message, token) { return new PerlScriptSyntaxError(message, { source: this.source, range: token.range }); }
}

/** @param {string} source */
export function parse(source) { return new Parser(source).parse(); }
