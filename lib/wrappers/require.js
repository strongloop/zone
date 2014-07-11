var Module = require('module').Module;
var NativeModule = require('./node-lib/native_module');

var realRequire = Module.prototype.require;
Module.prototype._realRequire = realRequire;

function load(path) {
  switch (path) {
    case '_http_agent':
      return realRequire(__dirname + '/node-lib/' + path + '.js');

    case 'buffer':
      return realRequire.apply(this, arguments);

    case 'native:_http_agent':
      path = path.replace(/^native:/, '');
      return NativeModule.require(path);

    default:
      if (NativeModule.exists(path))
        return NativeModule.require(path);
      else
        return realRequire.apply(this, arguments);
  }
}

Module.prototype.require = zone.root.bindCallback(
    this, load, zone.root, {autoRelease: false, name: 'Module.require'});
