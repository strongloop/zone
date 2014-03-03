
// Monkey-patch require
var Module = require('module').Module;

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
    case 'net':
    case 'stream':
    case '_stream_duplex':
    case '_stream_passthrough':
    case '_stream_readable':
    case '_stream_transform':
    case '_stream_writable':
      return patch(path);

    case 'node:fs':
      return realRequire('fs');

    default:
      return realRequire.apply(this, arguments);
  }
};
