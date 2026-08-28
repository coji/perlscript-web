import { hasErrorHandler, runScripts } from "./browser.js";

export { run, runScripts, disposeScript, setErrorHandler, registerStream } from "./browser.js";
export { installWebAdapters } from "./web-adapters.js";
export { installImageAdapter } from "./image-adapter.js";

if (typeof document !== "undefined") {
  const start = () => runScripts().catch(error => {
    if (!hasErrorHandler()) setTimeout(() => { throw error; });
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else queueMicrotask(start);
}
