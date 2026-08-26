export declare class PerlScriptSyntaxError extends SyntaxError {
    range: import("./types.js").SourceRange | undefined;
    excerpt: string;
    /** @param {string} message @param {{source?:string, range?:import('./types.js').SourceRange, cause?:*}} [options] */
    constructor(message: string, { source, range, cause }?: {
        source?: string;
        range?: import('./types.js').SourceRange;
        cause?: any;
    });
}
export declare class PerlScriptRuntimeError extends Error {
    range: import("./types.js").SourceRange | undefined;
    excerpt: string;
    uiStack: string[];
    /** @param {string} message @param {{source?:string, range?:import('./types.js').SourceRange, cause?:*, uiStack?:string[]}} [options] */
    constructor(message: string, { source, range, cause, uiStack }?: {
        source?: string;
        range?: import('./types.js').SourceRange;
        cause?: any;
        uiStack?: string[];
    });
}
