import { MemoryIO } from "./io.js";
export declare class BrowserIO extends MemoryIO {
    document: Document;
    streams: Map<string, Function>;
    storage: {
        local: any;
        session: any;
    };
    navigation: any;
    clock: {
        now: any;
        setInterval: any;
        clearInterval: any;
    };
    /** @type {Map<string,{element:HTMLStyleElement,value:string}>} */
    styles: Map<string, {
        element: HTMLStyleElement;
        value: string;
    }>;
    /** @type {{storage:Map<*,Map<string,{original:string|null,value:string|null}>>,routes:Array<{navigation:*,mode:'hash'|'history',route:string}>,routeValues:Map<'hash'|'history',string>}|null} */
    effects: {
        storage: Map<any, Map<string, {
            original: string | null;
            value: string | null;
        }>>;
        routes: Array<{
            navigation: any;
            mode: 'hash' | 'history';
            route: string;
        }>;
        routeValues: Map<'hash' | 'history', string>;
    } | null;
    /**
     * @param {Document} document
     * @param {{streams?:Map<string,Function>|Record<string,Function>,storage?:{local?:*,session?:*},navigation?:*,clock?:{now?:()=>number,setInterval?:(callback:Function,interval:number)=>*,clearInterval?:(timer:*)=>void}}} [options]
     */
    constructor(document: Document, options?: {
        streams?: Map<string, Function> | Record<string, Function>;
        storage?: {
            local?: any;
            session?: any;
        };
        navigation?: any;
        clock?: {
            now?: () => number;
            setInterval?: (callback: Function, interval: number) => any;
            clearInterval?: (timer: any) => void;
        };
    });
    beginEffects(): void;
    commitEffects(): void;
    rollbackEffects(): void;
    /** @param {*} area @param {string} key */
    storageValue(area: any, key: string): any;
    /** @param {*} area @param {string} key @param {string|null} value */
    setStorageValue(area: any, key: string, value: string | null): void;
    /** @param {'hash'|'history'} mode */
    routeValue(mode: 'hash' | 'history'): string;
    /** @param {'hash'|'history'} mode @param {string} value */
    publishRoute(mode: 'hash' | 'history', value: string): void;
    /** @param {string} name @param {*} spec */
    open(name: string, spec: any): void;
    /** @param {string} name */
    read(name: string): string;
    /** @param {string} name @param {*} value */
    write(name: string, value: any): any;
    /** @param {string} [name] */
    clear(name?: string): void;
    /** @param {string} handleName @param {string} subName @param {Function} callback */
    watch(handleName: string, subName: string, callback: Function): void;
    /** @param {string} name */
    eof(name: string): void | "" | 1;
    /** @param {string} name */
    close(name: string): void;
    /** @param {string} name */
    validateUI(name: string): void;
    /** @param {string} name @param {import('./ui.js').UITreeBuilder['root']} tree @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch */
    commitUI(name: string, tree: import('./ui.js').UITreeBuilder['root'], dispatch: (sub: string | null, args: any[], updates: Array<[string, any]>) => void): void;
    dispose(): void;
}
