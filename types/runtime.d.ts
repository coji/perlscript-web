import { MemoryIO } from "./io.js";
import { UITreeBuilder } from "./ui.js";
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
    /** @type {Map<string,string>} */
    mounts: Map<string, string>;
    /** @type {UITreeBuilder|null} */
    uiBuilder: UITreeBuilder | null;
    rendering: boolean;
    dirty: boolean;
    /** @type {string[]} */
    callStack: string[];
    /** @type {Array<Record<string,*>>} */
    events: Array<Record<string, any>>;
    /** @type {Set<(event:Record<string,*>)=>void>} */
    observers: Set<(event: Record<string, any>) => void>;
    eventSequence: number;
    lastSub: string;
    renderCount: number;
    transactionCount: number;
    /** @param {{io?:MemoryIO,maxIterations?:number,onError?:((error:Error)=>void)|null}} [options] */
    constructor({ io, maxIterations, onError }?: {
        io?: MemoryIO;
        maxIterations?: number;
        onError?: ((error: Error) => void) | null;
    });
    /** @param {Record<string,*>} event */
    record(event: Record<string, any>): void;
    /** @param {(event:Record<string,*>)=>void} observer @returns {()=>void} */
    subscribe(observer: (event: Record<string, any>) => void): () => void;
    /** @returns {{scalars:Record<string,*>,arrays:Record<string,*[]>,hashes:Record<string,Record<string,*>>,handles:Array<{name:string,type:string}>,mounts:Array<{handle:string,view:string}>,lastSub:string,renderCount:number,transactionCount:number,events:Array<Record<string,*>>}} */
    inspect(): {
        scalars: Record<string, any>;
        arrays: Record<string, any[]>;
        hashes: Record<string, Record<string, any>>;
        handles: Array<{
            name: string;
            type: string;
        }>;
        mounts: Array<{
            handle: string;
            view: string;
        }>;
        lastSub: string;
        renderCount: number;
        transactionCount: number;
        events: Array<Record<string, any>>;
    };
    /** @param {Record<string,*>} record @returns {Record<string,*>} */
    inspectRecord(record: Record<string, any>): Record<string, any>;
    /** @param {*} value @returns {*} */
    inspectValue(value: any): any;
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
    /** @param {*} handleValue @param {*} viewValue */
    mount(handleValue: any, viewValue: any): string;
    /** @param {string} operation @returns {UITreeBuilder} */
    requireUI(operation: string): UITreeBuilder;
    markDirty(): void;
    flushUI(): void;
    /** @param {string|null} sub @param {*[]} args @param {Array<[string,*]>} updates */
    dispatchUI(sub: string | null, args: any[], updates: Array<[string, any]>): void;
    /** @param {()=>void} action */
    transaction(action: () => void): void;
    snapshot(): {
        scalars: any;
        arrays: any;
        hashes: any;
    };
    /** @param {{scalars:Record<string,*>,arrays:Record<string,*>,hashes:Record<string,*>}} state */
    restore(state: {
        scalars: Record<string, any>;
        arrays: Record<string, any>;
        hashes: Record<string, any>;
    }): void;
    /** @param {Record<string,*>} record */
    cloneRecord(record: Record<string, any>): any;
    /** @param {*} value @returns {*} */
    cloneValue(value: any): any;
    dispose(): void;
}
