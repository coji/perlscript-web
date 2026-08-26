import { MemoryIO } from "./io.js";

export class BrowserIO extends MemoryIO {
  /** @param {Document} document */
  constructor(document) {
    super();
    this.document = document;
    /** @type {Array<() => void>} */
    this.listeners = [];
  }

  /** @param {string} name @param {*} spec */
  open(name, spec) {
    const value = String(spec);
    const output = value.startsWith(">");
    const body = output ? value.slice(1) : value;
    let type;
    let event;
    let selector;
    if (body.startsWith("dom:")) {
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
    this.handles.set(name, type === "event"
      ? { type: "event", element, event: event || "" }
      : { type: output ? "dom-out" : "dom-in", element });
  }

  /** @param {string} name */
  read(name) {
    const handle = this.require(name);
    if (handle.type === "dom-in") return String("value" in handle.element ? handle.element.value : handle.element.textContent || "");
    return super.read(name);
  }

  /** @param {string} name @param {*} value */
  write(name, value) {
    const handle = this.require(name);
    if (handle.type === "dom-in") { if ("value" in handle.element) handle.element.value = String(value); else handle.element.textContent = String(value); return; }
    if (handle.type === "dom-out") {
      if (typeof handle.element.append === "function") {
        const text = this.document.createTextNode?.(String(value)) ?? String(value);
        handle.element.append(text);
      } else {
        handle.element.textContent = (handle.element.textContent || "") + value;
      }
      return;
    }
    super.write(name, value);
  }

  /** @param {string} [name] */
  clear(name = this.selected) {
    const handle = this.require(name);
    if (handle.type === "dom-out" || handle.type === "dom-in") { if ("value" in handle.element && handle.type === "dom-in") handle.element.value = ""; else handle.element.textContent = ""; return; }
    super.clear(name);
  }

  /** @param {string} handleName @param {string} subName @param {Function} callback */
  watch(handleName, subName, callback) {
    const handle = this.require(handleName);
    if (handle.type !== "event") throw new Error(`${handleName} is not an event filehandle`);
    /** @param {Event} event */
    const listener = event => {
      const keyboard = /** @type {KeyboardEvent} */ (event);
      if (handle.event === "keydown" && (keyboard.key !== "Enter" || keyboard.isComposing || keyboard.keyCode === 229)) return;
      callback(event, subName);
    };
    handle.element.addEventListener(handle.event, listener);
    this.listeners.push(() => handle.element.removeEventListener(handle.event, listener));
  }

  dispose() { for (const remove of this.listeners.splice(0)) remove(); }
}
