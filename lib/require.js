
// Monkey-patch require
var Module = require('module').Module;
var NativeModule = require('./node-lib/native_module.js');

var realRequire = Module.prototype.require;

var refused = {};

function patch(path) {
  if ((process.env.NOPATCH || '').search(path) >= 0) {
    if (!refused[path]) {
      refused[path] = true;
      console.error('zone - not patching', path);
    }
    return realRequire(path);
  }
  return require(__dirname + '/node-lib/' + path);
}

Module.prototype.require = function require(path) {
  switch (path) {
    case 'fs':
      return patch(path);

    case 'node:fs':
      return NativeModule.require('fs');

    default:
      if (NativeModule.exists(path))
        return NativeModule.require(path);
      else
        return realRequire.apply(this, arguments);
  }
};
