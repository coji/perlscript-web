/**
 * Resize and encode an uploaded raster image for storage and UI use.
 * @param {File|Blob} file
 * @param {{document?:Document,createImageBitmap?:Function,size?:number,quality?:number,maxOutputBytes?:number,fit?:'cover'|'contain'}} [options]
 */
export declare function processImageUpload(file: File | Blob, options?: {
    document?: Document;
    createImageBitmap?: Function;
    size?: number;
    quality?: number;
    maxOutputBytes?: number;
    fit?: 'cover' | 'contain';
}): Promise<{
    data: string;
    width: number;
    height: number;
    bytes: number;
    mime: string;
}>;
/**
 * Create a generic image stream factory. Perl writes a JSON command containing
 * an input selector, then reads an `image.result` or `image.error` record.
 * @param {{document?:Document,processImage?:(file:File|Blob,options:*)=>Promise<*>,maxInputBytes?:number}} [options]
 */
export declare function createImageAdapter(options?: {
    document?: Document;
    processImage?: (file: File | Blob, options: any) => Promise<any>;
    maxInputBytes?: number;
}): ({ emit, end }: {
    emit: (value: any) => void;
    end: () => void;
}) => {
    write(/** @type {string} */ raw: string): void;
    close(): void;
};
/** @param {{document?:Document,processImage?:(file:File|Blob,options:*)=>Promise<*>,maxInputBytes?:number}} [options] */
export declare function installImageAdapter(options?: {
    document?: Document;
    processImage?: (file: File | Blob, options: any) => Promise<any>;
    maxInputBytes?: number;
}): () => void;
