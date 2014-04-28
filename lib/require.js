
// Monkey-patch require
var Module = require('module').Module;
var NativeModule = require('./node-lib/native_module.js');

var realRequire = Module.prototype.require;


function load(path) {
  switch (path) {
    case 'events':
      return realRequire(__dirname + '/node-lib/' + path);

    case 'buffer':
      return realRequire.apply(this, arguments);

    default:
      if (NativeModule.exists(path))
        return NativeModule.require(path);
      else
        return realRequire.apply(this, arguments);
  }
}


Module.prototype.require = function require(path) {
  var previousZone = zone;
  zone = zone.root;

  try {
    return load.call(this, path);

  } finally {
    zone = previousZone;
  }
};
