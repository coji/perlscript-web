/**
 * Create generic `secret` and `http` stream factories without registering them globally.
 * @param {{storage?:*,fetch?:typeof globalThis.fetch,secretPrefix?:string}} [options]
 */
export declare function createWebAdapters(options?: {
    storage?: any;
    fetch?: typeof globalThis.fetch;
    secretPrefix?: string;
}): {
    secret: ({ emit, end }: {
        emit: (value: any) => void;
        end: () => void;
    }) => {
        write(/** @type {string} */ raw: string): void;
    };
    http: ({ emit, end }: {
        emit: (value: any) => void;
        end: () => void;
    }) => {
        write(/** @type {string} */ raw: string): void;
        close(): void;
    };
};
/** @param {{storage?:*,fetch?:typeof globalThis.fetch,secretPrefix?:string}} [options] @returns {()=>void} */
export declare function installWebAdapters(options?: {
    storage?: any;
    fetch?: typeof globalThis.fetch;
    secretPrefix?: string;
}): () => void;
