import { Runtime } from "./runtime.js";
import { BrowserIO } from "./browser-io.js";

/** @type {WeakMap<HTMLScriptElement, Runtime>} */
const active = new WeakMap();
/** @type {WeakMap<HTMLScriptElement, number>} */
const generations = new WeakMap();
let nextGeneration = 0;
/** @type {((error:Error)=>void)|null} */
let defaultErrorHandler = null;

/** @param {((error:Error)=>void)|null} handler */
export function setErrorHandler(handler) {
  if (handler !== null && typeof handler !== "function") throw new TypeError("Error handler must be a function or null");
  defaultErrorHandler = handler;
}

/** @returns {boolean} */
export function hasErrorHandler() { return defaultErrorHandler !== null; }

/** @param {*} error @param {((error:Error)=>void)|null} handler */
function report(error, handler) {
  const normalized = error instanceof Error ? error : new Error(String(error));
  handler?.(normalized);
}

/** @param {string} source @param {{document?:Document, io?:import('./io.js').MemoryIO, onError?:((error:Error)=>void)|null}} [options] */
export function run(source, options = {}) {
  const document = options.document || globalThis.document;
  if (!document) throw new Error("PerlScript.run requires a document");
  const onError = options.onError === undefined ? defaultErrorHandler : options.onError;
  const runtime = new Runtime({ io: options.io || new BrowserIO(document), onError });
  try {
    runtime.run(source);
  } catch (error) {
    runtime.dispose();
    report(error, onError);
    throw error;
  }
  return runtime;
}

/** @param {Document} [root] @param {{onError?:((error:Error)=>void)|null}} [options] */
export async function runScripts(root = globalThis.document, options = {}) {
  if (!root) return [];
  const scripts = /** @type {HTMLScriptElement[]} */ ([...root.querySelectorAll('script[type="text/perl"]')]);
  const runtimes = [];
  const generation = ++nextGeneration;
  for (const script of scripts) {
    if ((generations.get(script) || 0) > generation) continue;
    generations.set(script, generation);
    let source;
    try {
      source = script.src ? await fetch(script.src).then(response => {
        if (!response.ok) throw new Error(`Unable to load ${script.src}: ${response.status}`);
        return response.text();
      }) : script.textContent;
    } catch (error) {
      if (generations.get(script) !== generation) continue;
      report(error, options.onError === undefined ? defaultErrorHandler : options.onError);
      throw error;
    }
    if (generations.get(script) !== generation) continue;
    const runtime = run(source, { document: script.ownerDocument || root, onError: options.onError });
    if (generations.get(script) !== generation) {
      runtime.dispose();
      continue;
    }
    const previous = active.get(script);
    active.set(script, runtime);
    previous?.dispose();
    runtimes.push(runtime);
  }
  return runtimes;
}

/** @param {HTMLScriptElement} script */
export function disposeScript(script) {
  generations.set(script, ++nextGeneration);
  active.get(script)?.dispose();
  active.delete(script);
}
