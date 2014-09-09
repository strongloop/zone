// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = NativeModule;

var runInThisContext;

if (/^v0\.10\./.test(process.version)) {
  // Node v0.10
  runInThisContext =
      process.binding('evals').NodeScript.runInThisContext;

} else {
  // Node v0.11+
  var ContextifyScript = process.binding('contextify').ContextifyScript;
  runInThisContext = function runInThisContext(code, options) {
    var script = new ContextifyScript(code, options);
    return script.runInThisContext();
  };
}

function NativeModule(id) {
  this.filename = id + '.js';
  this.id = id;
  this.exports = {};
  this.loaded = false;
}

NativeModule._source = process.binding('natives');
NativeModule._cache = {};

NativeModule.require = function(id) {
  if (id == 'native_module') {
    return NativeModule;
  }

  var cached = NativeModule.getCached(id);
  if (cached) {
    return cached.exports;
  }

  if (!NativeModule.exists(id)) {
    throw new Error('No such native module ' + id);
  }

  process.moduleLoadList.push('NativeModule ' + id);

  var nativeModule = new NativeModule(id);

  nativeModule.cache();
  nativeModule.compile();

  return nativeModule.exports;
};

NativeModule.getCached = function(id) { return NativeModule._cache[id]; };

NativeModule.exists =
    function(id) { return NativeModule._source.hasOwnProperty(id); };

NativeModule.getSource = function(id) { return NativeModule._source[id]; };

NativeModule.wrap = function(script) {
  return NativeModule.wrapper[0] + script + NativeModule.wrapper[1];
};

NativeModule.wrapper = [
  '(function (exports, require, module, __filename, __dirname) { ',
  '\n});'
];

NativeModule.prototype.compile = function() {
  var source = NativeModule.getSource(this.id);
  source = NativeModule.wrap(source);

  var fn = runInThisContext(source, {filename: this.filename});
  fn(this.exports, require, this, this.filename);

  this.loaded = true;
};

NativeModule.prototype.cache =
    function() { NativeModule._cache[this.id] = this; };
