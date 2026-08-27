import { Runtime } from "./runtime.js";
/**
 * Register a host-owned asynchronous text stream for `open HANDLE, "stream:name"`.
 * @param {string} name
 * @param {(sink:{emit:(value:*)=>void,end:()=>void})=>{write:(value:string)=>*,close?:()=>void}} factory
 * @returns {()=>void}
 */
export declare function registerStream(name: string, factory: (sink: {
    emit: (value: any) => void;
    end: () => void;
}) => {
    write: (value: string) => any;
    close?: () => void;
}): () => void;
/** @param {((error:Error)=>void)|null} handler */
export declare function setErrorHandler(handler: ((error: Error) => void) | null): void;
/** @returns {boolean} */
export declare function hasErrorHandler(): boolean;
/** @param {string} source @param {{document?:Document, io?:import('./io.js').MemoryIO, onError?:((error:Error)=>void)|null}} [options] */
export declare function run(source: string, options?: {
    document?: Document;
    io?: import('./io.js').MemoryIO;
    onError?: ((error: Error) => void) | null;
}): Runtime;
/** @param {Document} [root] @param {{onError?:((error:Error)=>void)|null}} [options] */
export declare function runScripts(root?: Document, options?: {
    onError?: ((error: Error) => void) | null;
}): Promise<Runtime[]>;
/** @param {HTMLScriptElement} script */
export declare function disposeScript(script: HTMLScriptElement): void;
