import { MemoryIO } from "./io.js";
import { DOMUIRenderer } from "./ui.js";

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (/** @type {string} */ key) => values.get(key) ?? null,
    setItem: (/** @type {string} */ key, /** @type {string} */ value) => values.set(key, String(value)),
    removeItem: (/** @type {string} */ key) => values.delete(key),
  };
};
const fallbackStorage = { local: memoryStorage(), session: memoryStorage() };

/** @param {Document} document @param {'local'|'session'} kind @param {*} override */
function resolveStorage(document, kind, override) {
  if (override) return override;
  try {
    const property = `${kind}Storage`;
    const view = /** @type {*} */ (document.defaultView);
    const root = /** @type {*} */ (globalThis);
    return view?.[property] || root[property] || fallbackStorage[kind];
  } catch { return fallbackStorage[kind]; }
}

/** @param {Document} document @param {*} override */
function resolveNavigation(document, override) {
  if (override) return override;
  const view = /** @type {*} */ (document.defaultView || globalThis.window);
  if (!view?.location || !view?.history || typeof view.addEventListener !== "function") return null;
  return view;
}

/** @param {*} override */
function resolveClock(override) {
  return {
    now: override?.now || Date.now,
    setInterval: override?.setInterval || globalThis.setInterval.bind(globalThis),
    clearInterval: override?.clearInterval || globalThis.clearInterval.bind(globalThis),
  };
}

/** @param {*} navigation @param {'hash'|'history'} mode */
function currentRoute(navigation, mode) {
  if (mode === "hash") return String(navigation.location.hash || "").replace(/^#/, "") || "/";
  return `${navigation.location.pathname || "/"}${navigation.location.search || ""}${navigation.location.hash || ""}`;
}

/** @param {string} route */
function validateRoute(route) {
  if (!route.startsWith("/") || route.startsWith("//") || /[\r\n]/.test(route)) throw new Error(`Invalid route ${route || "(empty)"}`);
}

export class BrowserIO extends MemoryIO {
  /**
   * @param {Document} document
   * @param {{streams?:Map<string,Function>|Record<string,Function>,storage?:{local?:*,session?:*},navigation?:*,clock?:{now?:()=>number,setInterval?:(callback:Function,interval:number)=>*,clearInterval?:(timer:*)=>void}}} [options]
   */
  constructor(document, options = {}) {
    super();
    this.document = document;
    this.streams = options.streams instanceof Map ? options.streams : new Map(Object.entries(options.streams || {}));
    this.storage = {
      local: resolveStorage(document, "local", options.storage?.local),
      session: resolveStorage(document, "session", options.storage?.session),
    };
    this.navigation = resolveNavigation(document, options.navigation);
    this.clock = resolveClock(options.clock);
    /** @type {Map<string,{element:HTMLStyleElement,value:string}>} */
    this.styles = new Map();
    /** @type {{storage:Map<*,Map<string,{original:string|null,value:string|null}>>,routes:Array<{navigation:*,mode:'hash'|'history',route:string}>,routeValues:Map<'hash'|'history',string>}|null} */
    this.effects = null;
  }

  beginEffects() {
    if (this.effects) throw new Error("Browser I/O effects are already staged");
    this.effects = { storage: new Map(), routes: [], routeValues: new Map() };
  }

  commitEffects() {
    const effects = this.effects;
    if (!effects) return;
    this.effects = null;
    try {
      for (const [area, entries] of effects.storage) {
        for (const [key, entry] of entries) {
          if (entry.value === null) area.removeItem(key);
          else area.setItem(key, entry.value);
        }
      }
      for (const { navigation, mode, route } of effects.routes) {
        if (mode === "hash") navigation.location.hash = `#${route}`;
        else navigation.history.pushState(null, "", route);
      }
    } catch (error) {
      for (const [area, entries] of effects.storage) {
        for (const [key, entry] of entries) {
          try {
            if (entry.original === null) area.removeItem(key);
            else area.setItem(key, entry.original);
          } catch { /* Preserve the commit error. */ }
        }
      }
      throw error;
    }
  }

  rollbackEffects() { this.effects = null; }

  /** @param {*} area @param {string} key */
  storageValue(area, key) {
    const staged = this.effects?.storage.get(area)?.get(key);
    return staged ? staged.value : area.getItem(key);
  }

  /** @param {*} area @param {string} key @param {string|null} value */
  setStorageValue(area, key, value) {
    if (!this.effects) {
      if (value === null) area.removeItem(key);
      else area.setItem(key, value);
      return;
    }
    let entries = this.effects.storage.get(area);
    if (!entries) {
      entries = new Map();
      this.effects.storage.set(area, entries);
    }
    const existing = entries.get(key);
    entries.set(key, { original: existing?.original ?? area.getItem(key), value });
  }

  /** @param {'hash'|'history'} mode */
  routeValue(mode) { return this.effects?.routeValues.get(mode) ?? currentRoute(this.navigation, mode); }

  /** @param {'hash'|'history'} mode @param {string} value */
  publishRoute(mode, value) {
    for (const [name, candidate] of this.handles) {
      if (candidate.type !== "route" || candidate.mode !== mode || candidate.value === value) continue;
      candidate.value = value;
      this.observe({ kind: "io", action: "change", handle: name });
      for (const callback of [...candidate.watchers]) callback();
    }
  }

  /** @param {string} name @param {*} spec */
  open(name, spec) {
    const value = String(spec);
    const append = value.startsWith(">>");
    const output = value.startsWith(">");
    const body = output ? value.slice(append ? 2 : 1) : value;
    let type;
    let event;
    let selector;
    if (body.startsWith("css:")) {
      const sheetName = body.slice(4);
      if (!output || !/^[A-Za-z0-9._-]+$/.test(sheetName)) throw new Error(`Invalid browser filehandle spec ${value}`);
      let sheet = this.styles.get(sheetName);
      if (!sheet) {
        const element = this.document.createElement("style");
        element.setAttribute("data-perlscript-css", sheetName);
        const parent = this.document.head || this.document.querySelector("head") || this.document.documentElement;
        if (!parent || typeof parent.append !== "function") throw new Error("Document cannot host a CSS filehandle");
        parent.append(element);
        sheet = { element, value: "" };
        this.styles.set(sheetName, sheet);
      }
      if (!append) {
        sheet.value = "";
        sheet.element.textContent = "";
      }
      if (this.handles.has(name)) this.close(name);
      this.handles.set(name, { type: "css", sheet });
      this.observe({ kind: "io", action: "open", handle: name, target: value });
      return;
    } else if (append) {
      throw new Error(`Invalid browser filehandle spec ${value}`);
    } else if (body.startsWith("route:")) {
      if (output || !/^route:(hash|history)$/.test(body)) throw new Error(`Invalid browser filehandle spec ${value}`);
      if (!this.navigation) throw new Error("Route filehandles require a browser navigation object");
      if (this.handles.has(name)) this.close(name);
      const mode = /** @type {'hash'|'history'} */ (body.slice(6));
      const navigation = this.navigation;
      /** @type {import('./types.js').RouteHandle} */
      const handle = { type: "route", mode, navigation, value: this.routeValue(mode), watchers: new Set(), removeListener: null };
      this.handles.set(name, handle);
      this.observe({ kind: "io", action: "open", handle: name, target: value });
      return;
    } else if (body.startsWith("clock:")) {
      if (output || !/^clock:[0-9]+$/.test(body)) throw new Error(`Invalid browser filehandle spec ${value}`);
      const interval = Number(body.slice(6));
      if (!Number.isSafeInteger(interval) || interval < 16 || interval > 86_400_000) throw new Error(`Invalid clock interval ${interval}`);
      if (this.handles.has(name)) this.close(name);
      this.handles.set(name, { type: "clock", interval, clock: this.clock, watchers: new Set(), timer: null });
      this.observe({ kind: "io", action: "open", handle: name, target: value });
      return;
    } else if (body.startsWith("storage:")) {
      const match = /^storage:(local|session):(.+)$/.exec(body);
      if (!match) throw new Error(`Invalid browser filehandle spec ${value}`);
      const kind = /** @type {'local'|'session'} */ (match[1]);
      const area = this.storage[kind];
      const key = match[2];
      if (this.handles.has(name)) this.close(name);
      if (output) this.setStorageValue(area, key, null);
      this.handles.set(name, { type: "storage", area, key, writable: output, value: "" });
      this.observe({ kind: "io", action: "open", handle: name, target: value });
      return;
    } else if (body.startsWith("stream:")) {
      if (output) throw new Error(`Stream filehandle is bidirectional: ${value}`);
      const streamName = body.slice(7);
      const factory = this.streams.get(streamName);
      if (!streamName || !factory) throw new Error(`Unknown browser stream ${streamName || value}`);
      if (this.handles.has(name)) this.close(name);
      /** @type {import('./types.js').StreamHandle} */
      const handle = {
        type: "stream",
        name: streamName,
        adapter: { write() {} },
        queue: [],
        watchers: new Set(),
        ended: true,
        closed: false,
      };
      const notify = () => { for (const callback of [...handle.watchers]) callback(); };
      const adapter = factory({
        emit: (/** @type {*} */ value) => { if (!handle.closed) { handle.queue.push(String(value)); notify(); } },
        end: () => { if (!handle.closed) { handle.ended = true; notify(); } },
      });
      if (!adapter || typeof adapter.write !== "function") throw new Error(`Browser stream ${streamName} must provide write()`);
      handle.adapter = adapter;
      this.handles.set(name, handle);
      this.observe({ kind: "io", action: "open", handle: name, target: value });
      return;
    } else if (body.startsWith("ui:")) {
      if (!output) throw new Error(`UI filehandle must be writable: ${value}`);
      selector = body.slice(3);
      if (!selector) throw new Error(`Invalid browser filehandle spec ${value}`);
      const element = this.document.querySelector(selector);
      if (!element) throw new Error(`No element matches ${selector}`);
      if (this.handles.has(name)) this.close(name);
      this.handles.set(name, { type: "ui", element, renderer: new DOMUIRenderer(this.document, element) });
      this.observe({ kind: "io", action: "open", handle: name, target: value });
      return;
    } else if (body.startsWith("dom:")) {
      type = "dom";
      selector = body.slice(4);
    } else if (body.startsWith("event:")) {
      type = "event";
      const separator = body.indexOf(":", 6);
      if (separator !== -1) {
        event = body.slice(6, separator);
        selector = body.slice(separator + 1);
      }
    } else {
      return super.open(name, spec);
    }
    if (!selector || (type === "event" && (!event || output))) {
      throw new Error(`Invalid browser filehandle spec ${value}`);
    }
    const element = this.document.querySelector(selector);
    if (!element) throw new Error(`No element matches ${selector}`);
    if (this.handles.has(name)) this.close(name);
    this.handles.set(name, type === "event"
      ? { type: "event", element, event: event || "", cleanups: new Set() }
      : { type: output ? "dom-out" : "dom-in", element });
    this.observe({ kind: "io", action: "open", handle: name, target: value });
  }

  /** @param {string} name */
  read(name) {
    const handle = this.require(name);
    if (handle.type === "route") { const value = this.routeValue(handle.mode); handle.value = value; this.observe({ kind: "io", action: "read", handle: name, bytes: value.length }); return value; }
    if (handle.type === "clock") { const value = String(Math.floor(handle.clock.now() / 1000)); this.observe({ kind: "io", action: "read", handle: name, bytes: value.length }); return value; }
    if (handle.type === "storage") { const value = String(this.storageValue(handle.area, handle.key) ?? ""); this.observe({ kind: "io", action: "read", handle: name, bytes: value.length }); return value; }
    if (handle.type === "stream") { const value = handle.queue.shift() ?? ""; this.observe({ kind: "io", action: "read", handle: name, bytes: value.length }); return value; }
    if (handle.type === "dom-in") { const value = String("value" in handle.element ? handle.element.value : handle.element.textContent || ""); this.observe({ kind: "io", action: "read", handle: name, bytes: value.length }); return value; }
    return super.read(name);
  }

  /** @param {string} name @param {*} value */
  write(name, value) {
    const handle = this.require(name);
    const bytes = String(value).length;
    if (handle.type === "route") {
      const route = String(value);
      validateRoute(route);
      if (this.effects) {
        this.effects.routes.push({ navigation: handle.navigation, mode: handle.mode, route });
        this.effects.routeValues.set(handle.mode, route);
      } else {
        if (handle.mode === "hash") handle.navigation.location.hash = `#${route}`;
        else handle.navigation.history.pushState(null, "", route);
      }
      this.publishRoute(handle.mode, route);
      this.observe({ kind: "io", action: "write", handle: name, bytes });
      return;
    }
    if (handle.type === "clock") throw new Error(`${name} is a read-only clock filehandle`);
    if (handle.type === "storage") {
      if (!handle.writable) throw new Error(`${name} is a read-only storage filehandle`);
      handle.value += String(value);
      this.setStorageValue(handle.area, handle.key, handle.value);
      this.observe({ kind: "io", action: "write", handle: name, bytes });
      return;
    }
    if (handle.type === "css") {
      handle.sheet.value += String(value);
      handle.sheet.element.textContent = handle.sheet.value;
      this.observe({ kind: "io", action: "write", handle: name, bytes });
      return;
    }
    if (handle.type === "stream") {
      if (handle.closed) throw new Error(`${name} is a closed stream filehandle`);
      handle.ended = false;
      this.observe({ kind: "io", action: "write", handle: name, bytes });
      return handle.adapter.write(String(value));
    }
    if (handle.type === "dom-in") { if ("value" in handle.element) handle.element.value = String(value); else handle.element.textContent = String(value); this.observe({ kind: "io", action: "write", handle: name, bytes }); return; }
    if (handle.type === "dom-out") {
      if (typeof handle.element.append === "function") {
        const text = this.document.createTextNode?.(String(value)) ?? String(value);
        handle.element.append(text);
      } else {
        handle.element.textContent = (handle.element.textContent || "") + value;
      }
      this.observe({ kind: "io", action: "write", handle: name, bytes });
      return;
    }
    super.write(name, value);
  }

  /** @param {string} [name] */
  clear(name = this.selected) {
    const handle = this.require(name);
    if (handle.type === "storage") { handle.value = ""; this.setStorageValue(handle.area, handle.key, null); this.observe({ kind: "io", action: "clear", handle: name }); return; }
    if (handle.type === "css") { handle.sheet.value = ""; handle.sheet.element.textContent = ""; this.observe({ kind: "io", action: "clear", handle: name }); return; }
    if (handle.type === "dom-out" || handle.type === "dom-in") { if ("value" in handle.element && handle.type === "dom-in") handle.element.value = ""; else handle.element.textContent = ""; this.observe({ kind: "io", action: "clear", handle: name }); return; }
    super.clear(name);
  }

  /** @param {string} handleName @param {string} subName @param {Function} callback */
  watch(handleName, subName, callback) {
    const handle = this.require(handleName);
    if (handle.type === "route") {
      handle.watchers.add(callback);
      if (!handle.removeListener) {
        const event = handle.mode === "hash" ? "hashchange" : "popstate";
        const listener = () => {
          const next = currentRoute(handle.navigation, handle.mode);
          this.publishRoute(handle.mode, next);
        };
        handle.navigation.addEventListener(event, listener);
        handle.removeListener = () => handle.navigation.removeEventListener(event, listener);
      }
      this.observe({ kind: "io", action: "watch", handle: handleName, sub: subName });
      return;
    }
    if (handle.type === "clock") {
      handle.watchers.add(callback);
      if (handle.timer === null) handle.timer = handle.clock.setInterval(() => {
        this.observe({ kind: "io", action: "tick", handle: handleName });
        for (const watcher of [...handle.watchers]) watcher();
      }, handle.interval);
      this.observe({ kind: "io", action: "watch", handle: handleName, sub: subName });
      return;
    }
    if (handle.type === "stream") {
      handle.watchers.add(callback);
      this.observe({ kind: "io", action: "watch", handle: handleName, sub: subName });
      return;
    }
    if (handle.type !== "event") throw new Error(`${handleName} is not a watchable filehandle`);
    /** @param {Event} event */
    const listener = event => {
      const keyboard = /** @type {KeyboardEvent} */ (event);
      if (handle.event === "keydown" && (keyboard.key !== "Enter" || keyboard.isComposing || keyboard.keyCode === 229)) return;
      callback(event, subName);
    };
    handle.element.addEventListener(handle.event, listener);
    handle.cleanups.add(() => handle.element.removeEventListener(handle.event, listener));
    this.observe({ kind: "io", action: "watch", handle: handleName, sub: subName });
  }

  /** @param {string} name */
  eof(name) {
    const handle = this.require(name);
    if (handle.type !== "stream") return super.eof(name);
    return handle.ended && handle.queue.length === 0 ? 1 : "";
  }

  /** @param {string} name */
  close(name) {
    const handle = this.require(name);
    if (handle.type === "route") {
      handle.watchers.clear();
      handle.removeListener?.();
      handle.removeListener = null;
    }
    if (handle.type === "clock") {
      handle.watchers.clear();
      if (handle.timer !== null) handle.clock.clearInterval(handle.timer);
      handle.timer = null;
    }
    if (handle.type === "stream" && !handle.closed) {
      handle.closed = true;
      handle.ended = true;
      handle.queue.length = 0;
      handle.watchers.clear();
      handle.adapter?.close?.();
    }
    if (handle.type === "event") {
      for (const cleanup of handle.cleanups) cleanup();
      handle.cleanups.clear();
    }
    if (handle.type === "ui") handle.renderer.dispose();
    this.handles.delete(name);
    this.observe({ kind: "io", action: "close", handle: name });
  }

  /** @param {string} name */
  validateUI(name) {
    const handle = this.require(name);
    if (handle.type !== "ui") throw new Error(`${name} is not a UI filehandle`);
  }

  /** @param {string} name @param {import('./ui.js').UITreeBuilder['root']} tree @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch */
  commitUI(name, tree, dispatch) {
    this.validateUI(name);
    const handle = this.require(name);
    if (handle.type !== "ui") return;
    handle.renderer.commit(tree, dispatch);
    this.observe({ kind: "io", action: "commit", handle: name });
  }

  dispose() {
    this.rollbackEffects();
    for (const [name] of [...this.handles]) if (name !== "STDOUT") this.close(name);
    for (const { element } of this.styles.values()) {
      if (typeof element.remove === "function") element.remove();
      else element.parentNode?.removeChild(element);
    }
    this.styles.clear();
  }
}
