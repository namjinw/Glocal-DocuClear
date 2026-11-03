const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function loadTs(relativePath, mocks = {}) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: filename,
    }).outputText;
    const localRequire = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('.')) {
        const candidate = path.resolve(path.dirname(filename), id);
        const resolved = [candidate, `${candidate}.ts`, `${candidate}.tsx`].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
        if (resolved) return load(resolved);
      }
      return require(require.resolve(id, { paths: [root] }));
    };
    vm.runInNewContext(output, {
      exports: module.exports, module, require: localRequire, console,
      setTimeout, clearTimeout, setInterval, clearInterval,
      AbortController, URL, File, Blob,
      localStorage: mocks.localStorage || { getItem: () => null, setItem() {} },
      fetch: mocks.fetch || (() => { throw new Error('Network is disabled in tests'); }),
      ...mocks.globals,
    }, { filename });
    return module.exports;
  }
  return load(path.resolve(root, relativePath));
}
module.exports = { loadTs };
