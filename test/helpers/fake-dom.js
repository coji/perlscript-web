export class FakeElement {
  constructor(value = "") {
    this.value = value;
    this.textContent = "";
    this.listeners = new Map();
    this.appendCalls = 0;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type);
    listeners?.delete(listener);
    if (listeners?.size === 0) this.listeners.delete(type);
  }

  emit(type, event = {}) {
    const defaults = { type, key: "Enter", keyCode: 13, isComposing: false };
    for (const listener of [...(this.listeners.get(type) || [])]) listener({ ...defaults, ...event });
  }

  listenerCount(type) {
    if (type) return this.listeners.get(type)?.size || 0;
    return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0);
  }

  append(...nodes) {
    this.appendCalls++;
    this.textContent += nodes.map(node => typeof node === "string" ? node : node?.textContent || "").join("");
  }
}

export function createFakeDocument(selectors = {}) {
  const elements = new Map(Object.entries(selectors));
  const requestedSelectors = [];
  const scripts = [];
  const document = {
    readyState: "complete",
    querySelector(selector) {
      requestedSelectors.push(selector);
      return elements.get(selector) || null;
    },
    querySelectorAll(selector) {
      return selector === 'script[type="text/perl"]' ? scripts : [];
    },
    createTextNode(text) {
      return { textContent: String(text) };
    },
  };
  return { document, elements, requestedSelectors, scripts };
}

export function createPerlScript(document, source, { src = "" } = {}) {
  return { ownerDocument: document, textContent: source, src };
}
