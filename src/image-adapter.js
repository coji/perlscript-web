import { registerStream } from "./browser.js";

const DEFAULT_MAX_INPUT_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_OUTPUT_BYTES = 250 * 1024;

/** @param {string} dataURL */
function dataURLBytes(dataURL) {
  const encoded = dataURL.split(",", 2)[1] || "";
  return Math.ceil(encoded.length * 3 / 4);
}

/**
 * Resize and encode an uploaded raster image for storage and UI use.
 * @param {File|Blob} file
 * @param {{document?:Document,createImageBitmap?:Function,size?:number,quality?:number,maxOutputBytes?:number,fit?:'cover'|'contain'}} [options]
 */
export async function processImageUpload(file, options = {}) {
  const document = options.document || globalThis.document;
  const decode = options.createImageBitmap || globalThis.createImageBitmap?.bind(globalThis);
  if (!document || !decode) throw new Error("Image processing is unavailable in this browser.");
  const size = Math.max(32, Math.min(2048, Number(options.size) || 512));
  const maxOutputBytes = Math.max(16 * 1024, Number(options.maxOutputBytes) || DEFAULT_MAX_OUTPUT_BYTES);
  const bitmap = await decode(file);
  try {
    if (!bitmap.width || !bitmap.height) throw new Error("The selected image has no visible pixels.");
    const contain = options.fit === "contain";
    const sourceSize = Math.min(bitmap.width, bitmap.height);
    const sourceX = contain ? 0 : (bitmap.width - sourceSize) / 2;
    const sourceY = contain ? 0 : (bitmap.height - sourceSize) / 2;
    const sourceWidth = contain ? bitmap.width : sourceSize;
    const sourceHeight = contain ? bitmap.height : sourceSize;
    const scale = contain ? Math.min(1, size / Math.max(bitmap.width, bitmap.height)) : 1;
    const outputWidth = contain ? Math.max(1, Math.round(bitmap.width * scale)) : size;
    const outputHeight = contain ? Math.max(1, Math.round(bitmap.height * scale)) : size;
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas image processing is unavailable.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
    let quality = Math.max(0.4, Math.min(0.95, Number(options.quality) || 0.82));
    let mime = "image/webp";
    let dataURL = canvas.toDataURL(mime, quality);
    if (!dataURL.startsWith("data:image/webp;base64,")) {
      mime = "image/jpeg";
      dataURL = canvas.toDataURL(mime, quality);
    }
    while (dataURLBytes(dataURL) > maxOutputBytes && quality > 0.4) {
      quality = Math.max(0.4, quality - 0.1);
      dataURL = canvas.toDataURL(mime, quality);
    }
    if (!dataURL.startsWith(`data:${mime};base64,`)) throw new Error("Image encoding is unavailable in this browser.");
    if (dataURLBytes(dataURL) > maxOutputBytes) throw new Error("The processed image is still too large to store.");
    return { data: dataURL, width: outputWidth, height: outputHeight, bytes: dataURLBytes(dataURL), mime };
  } finally { bitmap.close?.(); }
}

/**
 * Create a generic image stream factory. Perl writes a JSON command containing
 * an input selector, then reads an `image.result` or `image.error` record.
 * @param {{document?:Document,processImage?:(file:File|Blob,options:*)=>Promise<*>,maxInputBytes?:number}} [options]
 */
export function createImageAdapter(options = {}) {
  const document = options.document || globalThis.document;
  const processImage = options.processImage || ((file, command) => processImageUpload(file, { ...command, document }));
  const defaultMaxInputBytes = Number(options.maxInputBytes) || DEFAULT_MAX_INPUT_BYTES;
  /** @param {{emit:(value:*)=>void,end:()=>void}} sink */
  return ({ emit, end }) => {
    let closed = false;
    return {
      write(/** @type {string} */ raw) {
        /** @type {*} */
        let command = {};
        void (async () => {
          command = JSON.parse(raw);
          const selector = String(command.selector || "");
          if (!selector) throw new Error("Image command requires an input selector.");
          const input = /** @type {HTMLInputElement|null|undefined} */ (document?.querySelector(selector));
          const file = input?.files?.[0];
          if (!file) throw new Error("写真を選択してください。");
          if (!/^image\/(jpeg|png|webp|gif)$/i.test(String(file.type || ""))) throw new Error("JPEG、PNG、WebP、GIF画像を選択してください。");
          const maxInputBytes = Number(command.maxInputBytes) || defaultMaxInputBytes;
          if (file.size > maxInputBytes) throw new Error("画像ファイルが大きすぎます。");
          const result = await processImage(file, command);
          if (!closed) emit(JSON.stringify({ type: "image.result", id: String(command.id || ""), name: String(file.name || "image"), ...result }));
        })().catch(error => {
          if (!closed) emit(JSON.stringify({ type: "image.error", id: String(command.id || ""), message: error instanceof Error ? error.message : String(error) }));
        }).finally(() => { if (!closed) end(); });
      },
      close() { closed = true; },
    };
  };
}

/** @param {{document?:Document,processImage?:(file:File|Blob,options:*)=>Promise<*>,maxInputBytes?:number}} [options] */
export function installImageAdapter(options = {}) {
  return registerStream("image", createImageAdapter(options));
}
