const BLOCKED_TAGS = new Set(["base", "embed", "iframe", "link", "meta", "object", "script", "style"]);
const BOOLEAN_ATTRIBUTES = new Set(["checked", "disabled", "hidden", "multiple", "open", "readonly", "required", "selected"]);
const URL_ATTRIBUTES = new Set(["action", "formaction", "href", "src"]);
const TAG = /^[a-z][a-z0-9-]*$/;
const ATTRIBUTE = /^[A-Za-z_:][A-Za-z0-9_.:-]*$/;
const EVENT = /^[a-z][a-z0-9]*$/;

/** @param {*} value */
const perlTrue = value => !(value === "" || value === "0" || value === 0 || value === null || value === undefined || value === false);
/** @param {*} value */
const stringValue = value => value === null || value === undefined ? "" : String(value);

/** @typedef {{type:'text',value:string,dom?:Node}} UIText */
/** @typedef {{property:string,variable:string,value:*}} UIBinding */
/** @typedef {{sub:string,args:*[]}} UIEvent */
/** @typedef {{type:'element',tag:string,attrs:Record<string,*>,events:Record<string,UIEvent>,bindings:UIBinding[],key:string|null,children:UINode[],dom?:Element,cleanups?:Array<()=>void>}} UIElement */
/** @typedef {UIText|UIElement} UINode */
/** @typedef {{type:'root',children:UINode[]}} UIRoot */

export class UITreeBuilder {
  constructor() {
    /** @type {UIRoot} */
    this.root = { type: "root", children: [] };
    /** @type {Array<UIRoot|UIElement>} */
    this.stack = [this.root];
  }

  /** @returns {UIRoot|UIElement} */
  current() { return this.stack[this.stack.length - 1]; }

  /** @param {*} tagValue @param {*[]} attributePairs */
  begin(tagValue, attributePairs) {
    const tag = stringValue(tagValue).toLowerCase();
    if (!TAG.test(tag) || BLOCKED_TAGS.has(tag)) throw new Error(`Unsafe or invalid UI tag ${tag || "(empty)"}`);
    if (attributePairs.length % 2 !== 0) throw new Error(`UI element ${tag} requires attribute name/value pairs`);
    /** @type {Record<string,*>} */
    const attrs = Object.create(null);
    for (let index = 0; index < attributePairs.length; index += 2) {
      const name = stringValue(attributePairs[index]);
      const lower = name.toLowerCase();
      const value = attributePairs[index + 1];
      if (!ATTRIBUTE.test(name) || lower.startsWith("on") || lower === "innerhtml" || lower === "outerhtml" || lower === "srcdoc") {
        throw new Error(`Unsafe or invalid UI attribute ${name || "(empty)"}`);
      }
      if (URL_ATTRIBUTES.has(lower) && /^\s*javascript:/i.test(stringValue(value))) throw new Error(`Unsafe URL for UI attribute ${name}`);
      attrs[name] = value;
    }
    /** @type {UIElement} */
    const node = { type: "element", tag, attrs, events: Object.create(null), bindings: [], key: null, children: [] };
    this.current().children.push(node);
    this.stack.push(node);
  }

  /** @param {*} value */
  text(value) { this.current().children.push({ type: "text", value: stringValue(value) }); }

  /** @param {*} eventValue @param {*} subValue @param {*[]} args */
  on(eventValue, subValue, args = []) {
    const node = this.element("on");
    const event = stringValue(eventValue).toLowerCase();
    const sub = stringValue(subValue);
    if (!EVENT.test(event)) throw new Error(`Invalid UI event ${event || "(empty)"}`);
    if (!sub) throw new Error("UI event requires a subroutine name");
    node.events[event] = { sub, args };
  }

  /** @param {*} value */
  key(value) {
    const node = this.element("key");
    if (node.key !== null) throw new Error("UI element already has a key");
    node.key = stringValue(value);
  }

  /** @param {*} propertyValue @param {*} variableValue @param {*} value */
  bind(propertyValue, variableValue, value) {
    const node = this.element("bind");
    const property = stringValue(propertyValue);
    const variable = stringValue(variableValue).replace(/^\$/, "");
    if (property !== "value" && property !== "checked") throw new Error(`Unsupported UI binding property ${property || "(empty)"}`);
    const valueTag = node.tag === "input" || node.tag === "textarea" || node.tag === "select";
    const inputType = stringValue(node.attrs.type).toLowerCase();
    const checkedInput = node.tag === "input" && (inputType === "checkbox" || inputType === "radio");
    if ((property === "value" && !valueTag) || (property === "checked" && !checkedInput)) {
      throw new Error(`${node.tag} does not support UI binding property ${property}`);
    }
    if (!/^[A-Za-z_]\w*$/.test(variable)) throw new Error(`Invalid UI binding scalar ${variable || "(empty)"}`);
    if (node.bindings.some(binding => binding.property === property)) throw new Error(`Duplicate UI binding for ${property}`);
    node.bindings.push({ property, variable, value });
  }

  end() {
    if (this.stack.length === 1) throw new Error("Cannot close the UI root");
    this.stack.pop();
  }

  /** @returns {UIRoot} */
  finish() {
    if (this.stack.length !== 1) throw new Error(`Unclosed UI element ${/** @type {UIElement} */ (this.current()).tag}`);
    this.validateKeys(this.root);
    return this.root;
  }

  /** @param {UIRoot|UIElement} parent */
  validateKeys(parent) {
    const keys = new Set();
    for (const child of parent.children) {
      if (child.type !== "element") continue;
      if (child.key !== null) {
        if (keys.has(child.key)) throw new Error(`Duplicate UI key ${child.key}`);
        keys.add(child.key);
      }
      this.validateKeys(child);
    }
  }

  /** @param {string} operation @returns {UIElement} */
  element(operation) {
    const current = this.current();
    if (current.type !== "element") throw new Error(`${operation} requires a current UI element`);
    return current;
  }
}

export class DOMUIRenderer {
  /** @param {Document} document @param {Element} root */
  constructor(document, root) {
    this.document = document;
    this.root = root;
    /** @type {UIRoot|null} */
    this.tree = null;
  }

  /**
   * @param {UIRoot} tree
   * @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch
   */
  commit(tree, dispatch) {
    if (!this.tree) {
      const nodes = tree.children.map(node => this.create(node, dispatch));
      this.root.replaceChildren(...nodes);
    } else {
      this.patchChildren(this.root, this.tree.children, tree.children, dispatch);
    }
    this.tree = tree;
  }

  /** @param {UINode} node @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch @returns {Node} */
  create(node, dispatch) {
    if (node.type === "text") {
      const dom = this.document.createTextNode(node.value);
      node.dom = dom;
      return dom;
    }
    const element = this.document.createElement(node.tag);
    node.dom = element;
    this.patchElement(null, node, dispatch);
    element.append(...node.children.map(child => this.create(child, dispatch)));
    return element;
  }

  /**
   * @param {Element} parent @param {UINode[]} oldChildren @param {UINode[]} newChildren
   * @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch
   */
  patchChildren(parent, oldChildren, newChildren, dispatch) {
    const keyed = new Map();
    for (const old of oldChildren) if (old.type === "element" && old.key !== null) keyed.set(old.key, old);
    const used = new Set();
    /** @type {Node[]} */
    const ordered = [];
    for (let index = 0; index < newChildren.length; index++) {
      const next = newChildren[index];
      let previous = next.type === "element" && next.key !== null ? keyed.get(next.key) : oldChildren[index];
      if (previous && used.has(previous)) previous = undefined;
      if (previous && !this.compatible(previous, next)) previous = undefined;
      if (previous) {
        used.add(previous);
        ordered.push(this.patch(previous, next, dispatch));
      } else {
        ordered.push(this.create(next, dispatch));
      }
    }
    for (const old of oldChildren) if (!used.has(old)) this.remove(old);
    for (let index = 0; index < ordered.length; index++) {
      const reference = parent.childNodes[index] || null;
      if (reference !== ordered[index]) parent.insertBefore(ordered[index], reference);
    }
  }

  /** @param {UINode} oldNode @param {UINode} newNode */
  compatible(oldNode, newNode) { return oldNode.type === newNode.type && (oldNode.type === "text" || oldNode.tag === /** @type {UIElement} */ (newNode).tag); }

  /** @param {UINode} oldNode @param {UINode} newNode @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch @returns {Node} */
  patch(oldNode, newNode, dispatch) {
    if (oldNode.type === "text" && newNode.type === "text") {
      const dom = /** @type {Node} */ (oldNode.dom);
      if (oldNode.value !== newNode.value) dom.textContent = newNode.value;
      newNode.dom = dom;
      return dom;
    }
    const oldElement = /** @type {UIElement} */ (oldNode);
    const newElement = /** @type {UIElement} */ (newNode);
    const dom = /** @type {Element} */ (oldElement.dom);
    newElement.dom = dom;
    this.patchElement(oldElement, newElement, dispatch);
    this.patchChildren(dom, oldElement.children, newElement.children, dispatch);
    return dom;
  }

  /** @param {UIElement|null} oldNode @param {UIElement} node @param {(sub:string|null,args:*[],updates:Array<[string,*]>)=>void} dispatch */
  patchElement(oldNode, node, dispatch) {
    const element = /** @type {HTMLElement} */ (node.dom);
    for (const cleanup of oldNode?.cleanups || []) cleanup();
    node.cleanups = [];
    const oldAttrs = oldNode?.attrs || Object.create(null);
    for (const name of Object.keys(oldAttrs)) if (!(name in node.attrs)) element.removeAttribute(name);
    for (const [name, raw] of Object.entries(node.attrs)) {
      const lower = name.toLowerCase();
      if (BOOLEAN_ATTRIBUTES.has(lower)) {
        if (perlTrue(raw)) element.setAttribute(name, ""); else element.removeAttribute(name);
      } else {
        const value = stringValue(raw);
        if (element.getAttribute(name) !== value) element.setAttribute(name, value);
      }
    }
    /** @type {Map<string,{handler:UIEvent|null,bindings:UIBinding[]}>} */
    const actions = new Map();
    for (const [event, handler] of Object.entries(node.events)) actions.set(event, { handler, bindings: [] });
    for (const binding of node.bindings) {
      const propertyTarget = /** @type {Record<string,*>} */ (/** @type {*} */ (element));
      if (!(binding.property in propertyTarget)) throw new Error(`${node.tag} does not support UI binding property ${binding.property}`);
      const desired = binding.property === "checked" ? perlTrue(binding.value) : stringValue(binding.value);
      if (propertyTarget[binding.property] !== desired) propertyTarget[binding.property] = desired;
      const event = binding.property === "checked" || node.tag === "select" ? "change" : "input";
      const action = actions.get(event) || { handler: null, bindings: [] };
      action.bindings.push(binding);
      actions.set(event, action);
    }
    for (const [event, action] of actions) {
      /** @param {Event} browserEvent */
      const listener = browserEvent => {
        if (event === "submit") browserEvent.preventDefault();
        const target = /** @type {Record<string,*>} */ (/** @type {*} */ (element));
        const updates = action.bindings.map(binding => /** @type {[string,*]} */ ([binding.variable, target[binding.property]]));
        dispatch(action.handler?.sub || null, action.handler?.args || [], updates);
      };
      element.addEventListener(event, listener);
      node.cleanups.push(() => element.removeEventListener(event, listener));
    }
  }

  /** @param {UINode} node */
  remove(node) {
    this.cleanup(node);
    node.dom?.parentNode?.removeChild(node.dom);
  }

  /** @param {UINode} node */
  cleanup(node) {
    if (node.type === "text") return;
    for (const cleanup of node.cleanups || []) cleanup();
    for (const child of node.children) this.cleanup(child);
  }

  dispose() {
    if (this.tree) for (const child of this.tree.children) this.cleanup(child);
    this.tree = null;
  }
}
