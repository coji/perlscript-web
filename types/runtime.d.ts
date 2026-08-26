import { MemoryIO } from "./io.js";
export declare class Runtime {
    io: MemoryIO;
    maxIterations: number;
    onError: ((error: Error) => void) | null;
    /** @type {Record<string,*>} */
    scalars: Record<string, any>;
    /** @type {Record<string,*[]>} */
    arrays: Record<string, any[]>;
    /** @type {Record<string,Record<string,*>>} */
    hashes: Record<string, Record<string, any>>;
    /** @type {Map<string,import('./types.js').SubStatement>} */
    subs: Map<string, import('./types.js').SubStatement>;
    source: string;
    /** @param {{io?:MemoryIO,maxIterations?:number,onError?:((error:Error)=>void)|null}} [options] */
    constructor({ io, maxIterations, onError }?: {
        io?: MemoryIO;
        maxIterations?: number;
        onError?: ((error: Error) => void) | null;
    });
    /** @param {string} source @returns {Runtime} */
    run(source: string): Runtime;
    /** @param {import('./types.js').Program} program @returns {Runtime} */
    execute(program: import('./types.js').Program): Runtime;
    /** @param {import('./types.js').Statement} node @returns {*} */
    exec(node: import('./types.js').Statement): any;
    /** @param {import('./types.js').Statement} node @returns {*} */
    execNode(node: import('./types.js').Statement): any;
    /** @param {import('./types.js').Statement[]} body @returns {void} */
    execBlock(body: import('./types.js').Statement[]): void;
    /** @param {import('./types.js').Expression} node @returns {*} */
    eval(node: import('./types.js').Expression): any;
    /** @param {import('./types.js').Expression} node @returns {*} */
    evalNode(node: import('./types.js').Expression): any;
    /** @param {import('./types.js').Expression} node @param {*} value @returns {void} */
    assign(node: import('./types.js').Expression, value: any): void;
    /** @param {string} op @param {import('./types.js').Expression} leftNode @param {import('./types.js').Expression} rightNode @returns {*} */
    binary(op: string, leftNode: import('./types.js').Expression, rightNode: import('./types.js').Expression): any;
    /** @param {string} name @param {*[]} args @returns {*} */
    call(name: string, args: any[]): any;
    /** @param {string} value @returns {string} */
    interpolate(value: string): string;
    /** @param {import('./types.js').Expression} node @returns {*[]} */
    indexTarget(node: import('./types.js').Expression): any[];
    /** @param {import('./types.js').Expression} node @returns {Record<string,*>} */
    hashTarget(node: import('./types.js').Expression): Record<string, any>;
    /** @param {*} value @returns {Record<string,*>} */
    toHash(value: any): Record<string, any>;
    /** @param {*} value @returns {string} */
    stringify(value: any): string;
    dispose(): void;
}
