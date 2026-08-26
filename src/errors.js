/** @param {string} source @param {import('./types.js').SourceRange|undefined} range */
function excerptFor(source, range) {
  if (!source || !range) return "";
  const line = source.split("\n")[range.start.line - 1] || "";
  return `${line}\n${" ".repeat(Math.max(0, range.start.column - 1))}^`;
}

export class PerlScriptSyntaxError extends SyntaxError {
  /** @param {string} message @param {{source?:string, range?:import('./types.js').SourceRange, cause?:*}} [options] */
  constructor(message, { source = "", range, cause } = {}) {
    const location = range ? ` at ${range.start.line}:${range.start.column}` : "";
    super(`${message}${location}`, cause === undefined ? undefined : { cause });
    this.name = "PerlScriptSyntaxError";
    this.range = range;
    this.excerpt = excerptFor(source, range);
  }
}

export class PerlScriptRuntimeError extends Error {
  /** @param {string} message @param {{source?:string, range?:import('./types.js').SourceRange, cause?:*}} [options] */
  constructor(message, { source = "", range, cause } = {}) {
    const location = range ? ` at ${range.start.line}:${range.start.column}` : "";
    super(`${message}${location}`, cause === undefined ? undefined : { cause });
    this.name = "PerlScriptRuntimeError";
    this.range = range;
    this.excerpt = excerptFor(source, range);
  }
}
