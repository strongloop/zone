
// Monkey-patch require
var Module = require('module').Module;

var realRequire = Module.prototype.require;

Module.prototype.require = function require(path) {
  switch (path) {
    case 'events':
      // This probably isn't right
      return require(__dirname + '/node-lib/events.js');

    default:
      return realRequire.apply(this, arguments);
  }
};
