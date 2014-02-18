
// Monkey-patch require
var Module = require('module').Module;

var realRequire = Module.prototype.require;

var refused = {};

function patch(path) {
  if((process.env.NOPATCH || '').search(path) >= 0) {
    if(!refused[path]) {
      refused[path] = true;
      console.error('zone - not patching', path);
    }
    return realRequire(path);
  }
  return require(__dirname + '/node-lib/' + path);
}

Module.prototype.require = function require(path) {
  switch (path) {
    // This monkey patch is currently disabled because it's implementation
    // isn't compatible nor is it complete.
    /*
    case 'events':
      return patch(path);
    */

    case 'fs':
      return patch(path);

    case 'node:fs':
      return realRequire('fs');

    default:
      return realRequire.apply(this, arguments);
  }
};
