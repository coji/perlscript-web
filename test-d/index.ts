import {
  BrowserIO,
  MemoryIO,
  Parser,
  Runtime,
  disposeScript,
  parse,
  run,
  runScripts,
  setErrorHandler,
  tokenize,
} from "perlscript-web";

const io = new MemoryIO();
const runtime: Runtime = new Runtime({ io, maxIterations: 10, onError: error => console.error(error) });
runtime.run("print 1;");

setErrorHandler(error => console.error(error.message));
setErrorHandler(null);
tokenize("print 1;");
parse("print 1;");
new Parser("print 1;").parse();
new BrowserIO(document);
run("print 1;", { document, onError: null }).dispose();
void runScripts(document, { onError: null });
disposeScript(document.createElement("script"));
