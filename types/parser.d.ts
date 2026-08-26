import { PerlScriptSyntaxError } from "./errors.js";
export declare class Parser {
    source: string;
    tokens: import("./types.js").Token[];
    index: number;
    /** @param {string} source */
    constructor(source: string);
    /** @returns {import('./types.js').Token} */
    peek(n?: number): import('./types.js').Token;
    /** @returns {import('./types.js').Token} */
    take(): import('./types.js').Token;
    /** @param {string} value */
    is(value: string): boolean;
    /** @param {string} value @returns {import('./types.js').Token} */
    expect(value: string): import('./types.js').Token;
    /** @param {string} context @returns {import('./types.js').Token} */
    expectWord(context: string): import('./types.js').Token;
    /** @returns {import('./types.js').Program} */
    parse(): import('./types.js').Program;
    /** @returns {import('./types.js').Statement} */
    statement(): import('./types.js').Statement;
    /** @returns {{body:import('./types.js').Statement[],open:import('./types.js').Token,close:import('./types.js').Token}} */
    block(): {
        body: import('./types.js').Statement[];
        open: import('./types.js').Token;
        close: import('./types.js').Token;
    };
    /** @returns {import('./types.js').SubStatement} */
    subroutine(): import('./types.js').SubStatement;
    /** @returns {import('./types.js').IfStatement} */
    conditional(): import('./types.js').IfStatement;
    /** @returns {import('./types.js').WhileStatement} */
    whileStatement(): import('./types.js').WhileStatement;
    /** @returns {import('./types.js').Statement} */
    returnStatement(): import('./types.js').Statement;
    /** @returns {import('./types.js').OpenStatement} */
    openStatement(): import('./types.js').OpenStatement;
    /** @returns {import('./types.js').SelectStatement} */
    selectStatement(): import('./types.js').SelectStatement;
    /** @returns {import('./types.js').Statement} */
    printStatement(): import('./types.js').Statement;
    /** @param {import('./types.js').Statement} node @returns {import('./types.js').Statement} */
    finishStatement(node: import('./types.js').Statement): import('./types.js').Statement;
    /** @returns {import('./types.js').Expression} */
    expression(min?: number): import('./types.js').Expression;
    /** @returns {import('./types.js').Expression} */
    postfix(): import('./types.js').Expression;
    /** @returns {import('./types.js').Expression} */
    prefix(): import('./types.js').Expression;
    /** @returns {{args:import('./types.js').Expression[],close:import('./types.js').Token}} */
    arguments(): {
        args: import('./types.js').Expression[];
        close: import('./types.js').Token;
    };
    /** @param {string} message @param {import('./types.js').Token} token */
    error(message: string, token: import('./types.js').Token): PerlScriptSyntaxError;
}
/** @param {string} source */
export declare function parse(source: string): import("./types.js").Program;
