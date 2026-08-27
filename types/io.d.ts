export declare class MemoryIO {
    /** @type {Map<string, import('./types.js').FileHandle>} */
    handles: Map<string, import('./types.js').FileHandle>;
    selected: string;
    /** @type {((event:Record<string,*>)=>void)|null} */
    observer: ((event: Record<string, any>) => void) | null;
    constructor();
    /** @param {((event:Record<string,*>)=>void)|null} observer */
    setObserver(observer: ((event: Record<string, any>) => void) | null): void;
    /** @param {Record<string,*>} event */
    observe(event: Record<string, any>): void;
    /** @param {string} name @param {*} spec */
    open(name: string, spec: any): void;
    /** @param {string} name */
    select(name: string): void;
    /** @param {string} name */
    read(name: string): string;
    /** @param {string} name @param {*} value */
    write(name: string, value: any): void;
    /** @param {string} [name] */
    clear(name?: string): void;
    /** @param {string} _handleName @param {string} _subName @param {Function} _callback */
    watch(_handleName: string, _subName: string, _callback: Function): void;
    /** @param {string} name */
    eof(name: string): void;
    /** @param {string} name */
    close(name: string): void;
    /** @param {string} _name */
    validateUI(_name: string): void;
    /** @param {string} _name @param {*} _tree @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} _dispatch */
    commitUI(_name: string, _tree: any, _dispatch: (sub: string | null, args: any[], updates: Array<[string, any]>) => void): void;
    /** @param {string} name @returns {import('./types.js').FileHandle} */
    require(name: string): import('./types.js').FileHandle;
    dispose(): void;
}
