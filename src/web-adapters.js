import { registerStream } from "./browser.js";

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (/** @type {string} */ key) => values.get(key) ?? null,
    setItem: (/** @type {string} */ key, /** @type {string} */ value) => values.set(key, String(value)),
    removeItem: (/** @type {string} */ key) => values.delete(key),
  };
};

/** @param {*} override */
function resolveStorage(override) {
  if (override) return override;
  try { return globalThis.localStorage || memoryStorage(); }
  catch { return memoryStorage(); }
}

/** @param {*} response @param {(value:*)=>void} emit */
async function emitSSE(response, emit) {
  if (!response.body) throw new Error("Streaming response body is unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const dispatch = (/** @type {string} */ block) => {
    const data = block.split(/\r?\n/).filter((/** @type {string} */ line) => line.startsWith("data:")).map((/** @type {string} */ line) => line.slice(5).trimStart()).join("\n");
    if (data && data !== "[DONE]") emit(data);
  };
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    let boundary = buffer.match(/\r?\n\r?\n/);
    while (boundary && boundary.index !== undefined) {
      dispatch(buffer.slice(0, boundary.index));
      buffer = buffer.slice(boundary.index + boundary[0].length);
      boundary = buffer.match(/\r?\n\r?\n/);
    }
    if (done) break;
  }
  if (buffer.trim()) dispatch(buffer);
}

/**
 * Create generic `secret` and `http` stream factories without registering them globally.
 * @param {{storage?:*,fetch?:typeof globalThis.fetch,secretPrefix?:string}} [options]
 */
export function createWebAdapters(options = {}) {
  const storage = resolveStorage(options.storage);
  const fetcher = options.fetch || globalThis.fetch?.bind(globalThis);
  const secretPrefix = options.secretPrefix || "perlscript-web:secret:";
  const secrets = new Map();
  const secretKey = (/** @type {string} */ name) => `${secretPrefix}${name}`;
  const readStored = (/** @type {string} */ name) => {
    try { return String(storage.getItem(secretKey(name)) || ""); }
    catch { return ""; }
  };
  const writeStored = (/** @type {string} */ name, /** @type {string} */ value) => {
    try { if (value) storage.setItem(secretKey(name), value); else storage.removeItem(secretKey(name)); }
    catch { /* Storage is optional; the in-memory value still works. */ }
  };
  const resolveSecret = (/** @type {string} */ name) => {
    const value = secrets.get(name) || readStored(name);
    if (value) secrets.set(name, value);
    return value;
  };

  /** @param {{emit:(value:*)=>void,end:()=>void}} sink */
  const secret = ({ emit, end }) => ({
    write(/** @type {string} */ raw) {
      try {
        const command = JSON.parse(raw);
        const name = String(command.name || "");
        if (!name) throw new Error("Secret command requires a name.");
        if (command.op === "set") {
          const value = String(command.value || "");
          if (!value) throw new Error("Secret value cannot be empty.");
          secrets.set(name, value);
          writeStored(name, command.persist ? value : "");
        } else if (command.op === "persist") {
          const value = resolveSecret(name);
          writeStored(name, command.persist && value ? value : "");
        } else if (command.op === "delete") {
          secrets.delete(name);
          writeStored(name, "");
        } else if (command.op !== "status") {
          throw new Error(`Unknown secret operation ${command.op || "(empty)"}.`);
        }
        emit(JSON.stringify({ type: "secret.result", op: command.op, name, configured: Boolean(resolveSecret(name)), persisted: Boolean(readStored(name)) }));
      } catch (error) {
        emit(JSON.stringify({ type: "secret.error", message: error instanceof Error ? error.message : String(error) }));
      } finally { end(); }
    },
  });

  /** @param {{emit:(value:*)=>void,end:()=>void}} sink */
  const http = ({ emit, end }) => {
    /** @type {AbortController|null} */
    let controller = null;
    return {
      write(/** @type {string} */ raw) {
        controller?.abort();
        const current = new AbortController();
        controller = current;
        void (async () => {
          if (!fetcher) throw new Error("Fetch is unavailable in this browser.");
          const request = JSON.parse(raw);
          if (!/^https:\/\//.test(request.url || "")) throw new Error("HTTP stream requires an HTTPS URL.");
          const headers = new Headers(request.headers || {});
          const credential = request.bearer || (request.credential ? resolveSecret(String(request.credential)) : "");
          if (request.credential && !credential) {
            emit(JSON.stringify({ type: "http.error", code: "credential_missing", message: `Credential ${request.credential} is not configured.` }));
            return;
          }
          if (credential) headers.set("Authorization", `Bearer ${credential}`);
          let body;
          if (request.body !== undefined) {
            body = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
            if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
          }
          const response = await fetcher(request.url, { method: request.method || "GET", headers, body, signal: current.signal });
          if (!response.ok) {
            let message = `${response.status} ${response.statusText || ""}`.trim();
            try { message = (await response.json()).error?.message || message; } catch { /* Keep HTTP status. */ }
            emit(JSON.stringify({ type: "http.error", status: response.status, message }));
            return;
          }
          if (request.stream === "sse") await emitSSE(response, emit);
          else emit(JSON.stringify({ type: "http.response", status: response.status, body: await response.text() }));
        })().catch(error => {
          if (error?.name !== "AbortError") emit(JSON.stringify({ type: "http.error", message: error instanceof Error ? error.message : String(error) }));
        }).finally(() => {
          if (controller === current) { controller = null; end(); }
        });
      },
      close() { controller?.abort(); controller = null; },
    };
  };

  return {
    secret,
    http,
  };
}

/** @param {{storage?:*,fetch?:typeof globalThis.fetch,secretPrefix?:string}} [options] @returns {()=>void} */
export function installWebAdapters(options = {}) {
  const adapters = createWebAdapters(options);
  const unregisterSecret = registerStream("secret", adapters.secret);
  const unregisterHTTP = registerStream("http", adapters.http);
  return () => { unregisterHTTP(); unregisterSecret(); };
}
