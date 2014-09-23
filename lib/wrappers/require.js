var Module = require('module').Module;
var NativeModule = require('./node-lib/native_module');
var isv010 = require('../isv010.js');


var realRequire = Module.prototype.require;
Module.prototype._realRequire = realRequire;


var load;

if (isv010) {
  // Node v0.10 wrappers.
  load = function load(path) {
    switch (path) {
      case 'http':
      case 'events':
      case 'stream':
        return realRequire(__dirname + '/node-lib/' + path + '.js');

      case 'buffer':
        return realRequire.apply(this, arguments);

      default:
        if (/^native:/.test(path))
          return NativeModule.require(path.replace(/^native:/, ''));
        else if (NativeModule.exists(path))
          return NativeModule.require(path);
        else
          return realRequire.apply(this, arguments);
    }
  };

} else {
  // Node v0.11+ wrappers.
  load = function load(path) {
    switch (path) {
      case '_http_agent':
      case 'events':
      case 'stream':
        return realRequire(__dirname + '/node-lib/' + path + '.js');

      case 'buffer':
        return realRequire.apply(this, arguments);

      default:
        if (/^native:/.test(path))
          return NativeModule.require(path.replace(/^native:/, ''));
        else
          return realRequire.apply(this, arguments);
    }
  };
}


Module.prototype.require = zone.root.bindCallback(
    this, load, zone.root, {autoRelease: false, name: 'Module.require'});
