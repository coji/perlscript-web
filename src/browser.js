import { Runtime } from "./runtime.js";
import { BrowserIO } from "./browser-io.js";

/** @type {WeakMap<HTMLScriptElement, Runtime>} */
const active = new WeakMap();
/** @type {WeakMap<HTMLScriptElement, number>} */
const generations = new WeakMap();
let nextGeneration = 0;
/** @type {((error:Error)=>void)|null} */
let defaultErrorHandler = null;
/** @type {Map<string,Array<{factory:Function}>>} */
const streamRegistrations = new Map();

/** @returns {Map<string,Function>} */
function currentStreamFactories() {
  return new Map([...streamRegistrations].flatMap(([name, entries]) => {
    const current = entries.at(-1);
    return current ? [[name, current.factory]] : [];
  }));
}

/**
 * Register a host-owned asynchronous text stream for `open HANDLE, "stream:name"`.
 * @param {string} name
 * @param {(sink:{emit:(value:*)=>void,end:()=>void})=>{write:(value:string)=>*,close?:()=>void}} factory
 * @returns {()=>void}
 */
export function registerStream(name, factory) {
  if (!name || name.includes(":")) throw new TypeError("Stream name must be a non-empty name without colons");
  if (typeof factory !== "function") throw new TypeError("Stream factory must be a function");
  const entry = { factory };
  const entries = streamRegistrations.get(name) || [];
  entries.push(entry);
  streamRegistrations.set(name, entries);
  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;
    const current = streamRegistrations.get(name);
    if (!current) return;
    const index = current.indexOf(entry);
    if (index !== -1) current.splice(index, 1);
    if (current.length === 0) streamRegistrations.delete(name);
  };
}

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
  const runtime = new Runtime({ io: options.io || new BrowserIO(document, { streams: currentStreamFactories() }), onError });
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
    const document = script.ownerDocument || root;
    const io = new BrowserIO(document, { streams: currentStreamFactories() });
    io.beginEffects();
    let runtime;
    try {
      runtime = run(source, { document, io, onError: options.onError });
    } catch (error) {
      io.rollbackEffects();
      throw error;
    }
    if (generations.get(script) !== generation) {
      runtime.dispose();
      io.rollbackEffects();
      continue;
    }
    try {
      io.commitEffects();
    } catch (error) {
      runtime.dispose();
      report(error, options.onError === undefined ? defaultErrorHandler : options.onError);
      throw error;
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
