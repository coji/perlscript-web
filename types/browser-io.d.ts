import { MemoryIO } from "./io.js";
export declare class BrowserIO extends MemoryIO {
    document: Document;
    /** @type {Array<() => void>} */
    listeners: Array<() => void>;
    /** @param {Document} document */
    constructor(document: Document);
    /** @param {string} name @param {*} spec */
    open(name: string, spec: any): void;
    /** @param {string} name */
    read(name: string): string;
    /** @param {string} name @param {*} value */
    write(name: string, value: any): void;
    /** @param {string} [name] */
    clear(name?: string): void;
    /** @param {string} handleName @param {string} subName @param {Function} callback */
    watch(handleName: string, subName: string, callback: Function): void;
    /** @param {string} name */
    validateUI(name: string): void;
    /** @param {string} name @param {import('./ui.js').UITreeBuilder['root']} tree @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch */
    commitUI(name: string, tree: import('./ui.js').UITreeBuilder['root'], dispatch: (sub: string | null, args: any[], updates: Array<[string, any]>) => void): void;
    dispose(): void;
}
