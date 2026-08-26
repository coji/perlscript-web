export class FakeElement {
  constructor(value = "", tagName = "div") {
    this.value = value;
    this.checked = false;
    this.tagName = tagName.toUpperCase();
    this._textContent = "";
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.appendCalls = 0;
  }

  get textContent() {
    return this.childNodes.length ? this.childNodes.map(node => node.textContent || "").join("") : this._textContent;
  }

  set textContent(value) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    this._textContent = String(value);
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
    const defaults = { type, target: this, key: "Enter", keyCode: 13, isComposing: false, preventDefault() {} };
    for (const listener of [...(this.listeners.get(type) || [])]) listener({ ...defaults, ...event });
  }

  listenerCount(type) {
    if (type) return this.listeners.get(type)?.size || 0;
    return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0);
  }

  append(...nodes) {
    this.appendCalls++;
    this._textContent = "";
    for (const value of nodes) {
      const node = typeof value === "string" ? { textContent: value, parentNode: null } : value;
      if (node.parentNode) node.parentNode.removeChild(node);
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }

  replaceChildren(...nodes) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    this._textContent = "";
    this.append(...nodes);
  }

  insertBefore(node, reference) {
    if (node === reference) return node;
    if (node.parentNode) node.parentNode.removeChild(node);
    const index = reference === null ? this.childNodes.length : this.childNodes.indexOf(reference);
    if (index < 0) throw new Error("Reference node is not a child");
    node.parentNode = this;
    this.childNodes.splice(index, 0, node);
    return node;
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index < 0) throw new Error("Node is not a child");
    this.childNodes.splice(index, 1);
    node.parentNode = null;
    return node;
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
}

export function createFakeDocument(selectors = {}) {
  const elements = new Map(Object.entries(selectors));
  const requestedSelectors = [];
  const createdElements = [];
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
      return { textContent: String(text), parentNode: null };
    },
    createElement(tag) {
      const element = new FakeElement("", tag);
      createdElements.push(element);
      return element;
    },
  };
  return { document, elements, requestedSelectors, createdElements, scripts };
}

export function createPerlScript(document, source, { src = "" } = {}) {
  return { ownerDocument: document, textContent: source, src };
}
