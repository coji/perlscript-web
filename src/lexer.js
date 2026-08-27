import { PerlScriptSyntaxError } from "./errors.js";

const WORD_OPERATORS = new Set(["eq", "ne", "lt", "le", "gt", "ge"]);
export const ESCAPED_DOLLAR = "\u{E000}";

export class Lexer {
  /** @param {string} source */
  constructor(source) {
    this.source = source.replace(/\r\n?/g, "\n");
    this.index = 0;
    /** @type {import('./types.js').Token[]} */
    this.tokens = [];
    this.lineStarts = [0];
    for (let i = 0; i < this.source.length; i++) if (this.source[i] === "\n") this.lineStarts.push(i + 1);
  }

  /** @returns {import('./types.js').Token[]} */
  tokenize() {
    while (this.index < this.source.length) {
      const start = this.index;
      const c = this.source[this.index];
      if (/\s/.test(c)) { this.index++; continue; }
      if (c === "#") { this.skipComment(); continue; }
      if (c === '"' || c === "'") { this.tokens.push(this.readString(c)); continue; }
      if (/\d/.test(c)) { this.tokens.push(this.readNumber()); continue; }
      if (c === "$" && this.source[this.index + 1] === "#") { this.tokens.push(this.readArrayLast()); continue; }
      if (c === "$" || c === "@" || c === "%") { this.tokens.push(this.readVariable()); continue; }
      if (/[A-Za-z_]/.test(c)) { this.tokens.push(this.readWord()); continue; }
      if (c === "/" && this.canStartRegex()) { this.tokens.push(this.readRegex()); continue; }
      const op = ["=~", "!~", "==", "!=", "<=", ">=", "++", "--", "||", "&&"].find(value => this.source.startsWith(value, this.index));
      if (op) { this.index += op.length; this.tokens.push(this.token("op", op, start)); continue; }
      if ("{}()[];,<>.=!+-*/".includes(c)) { this.index++; this.tokens.push(this.token("punct", c, start)); continue; }
      throw this.error(`Unexpected character ${JSON.stringify(c)}`, start, start + 1);
    }
    this.tokens.push(this.token("eof", "", this.index));
    return this.tokens;
  }

  skipComment() { while (this.index < this.source.length && this.source[this.index] !== "\n") this.index++; }

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
        if (n === undefined) throw this.error("Unterminated string", start, this.index);
        if (quote === "'") value += (n === "\\" || n === "'") ? n : `\\${n}`;
        else if (n === "$") value += ESCAPED_DOLLAR;
        else {
          /** @type {Record<string,string>} */
          const escapes = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"' };
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

  canStartRegex() { const prev = this.tokens.at(-1); return prev?.value === "=~" || prev?.value === "!~"; }

  /** @returns {import('./types.js').Token} */
  readRegex() {
    const start = this.index++;
    let pattern = "";
    while (this.index < this.source.length) {
      const c = this.source[this.index++];
      if (c === "\\") { pattern += c + (this.source[this.index++] || ""); continue; }
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
  token(type, value, start, extra = {}) { return { type, value, range: this.range(start, this.index), ...extra }; }
  /** @param {number} start @param {number} end @returns {import('./types.js').SourceRange} */
  range(start, end) { return { start: this.position(start), end: this.position(end) }; }

  /** @param {number} offset @returns {import('./types.js').SourcePosition} */
  position(offset) {
    let low = 0;
    let high = this.lineStarts.length;
    while (low + 1 < high) {
      const middle = (low + high) >> 1;
      if (this.lineStarts[middle] <= offset) low = middle;
      else high = middle;
    }
    return { offset, line: low + 1, column: offset - this.lineStarts[low] + 1 };
  }

  /** @param {string} message @param {number} start @param {number} end */
  error(message, start, end) { return new PerlScriptSyntaxError(message, { source: this.source, range: this.range(start, end) }); }
}

/** @param {string} source */
export function tokenize(source) { return new Lexer(source).tokenize(); }
