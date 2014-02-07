
// Monkey-patch require
var Module = require('module').Module;

var realRequire = Module.prototype.require;

Module.prototype.require = function require(path) {
  switch (path) {
    // This monkey patch is currently disabled because it's implementation
    // isn't compatible nor is it complete.
    /*
    case 'events':
      return require(__dirname + '/node-lib/events.js');
    */

    case 'fs':
      return require(__dirname + '/node-lib/fs.js');

    case 'node:fs':
      return realRequire('fs');

    default:
      return realRequire.apply(this, arguments);
  }
};
