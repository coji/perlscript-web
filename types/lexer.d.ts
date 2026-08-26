import { PerlScriptSyntaxError } from "./errors.js";
export declare const ESCAPED_DOLLAR = "\uE000";
export declare class Lexer {
    source: string;
    index: number;
    /** @type {import('./types.js').Token[]} */
    tokens: import('./types.js').Token[];
    lineStarts: number[];
    /** @param {string} source */
    constructor(source: string);
    /** @returns {import('./types.js').Token[]} */
    tokenize(): import('./types.js').Token[];
    skipComment(): void;
    /** @returns {import('./types.js').Token} */
    /** @param {string} quote @returns {import('./types.js').Token} */
    readString(quote: string): import('./types.js').Token;
    /** @returns {import('./types.js').Token} */
    readNumber(): import('./types.js').Token;
    /** @returns {import('./types.js').Token} */
    readVariable(): import('./types.js').Token;
    /** @returns {import('./types.js').Token} */
    readArrayLast(): import('./types.js').Token;
    /** @returns {import('./types.js').Token} */
    readWord(): import('./types.js').Token;
    canStartRegex(): boolean;
    /** @returns {import('./types.js').Token} */
    readRegex(): import('./types.js').Token;
    /** @param {string} type @param {string} value @param {number} start @param {Partial<import('./types.js').Token>} [extra] @returns {import('./types.js').Token} */
    token(type: string, value: string, start: number, extra?: Partial<import('./types.js').Token>): import('./types.js').Token;
    /** @param {number} start @param {number} end @returns {import('./types.js').SourceRange} */
    range(start: number, end: number): import('./types.js').SourceRange;
    /** @param {number} offset @returns {import('./types.js').SourcePosition} */
    position(offset: number): import('./types.js').SourcePosition;
    /** @param {string} message @param {number} start @param {number} end */
    error(message: string, start: number, end: number): PerlScriptSyntaxError;
}
/** @param {string} source */
export declare function tokenize(source: string): import("./types.js").Token[];
