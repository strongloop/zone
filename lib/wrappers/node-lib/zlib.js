%nativeSource;

var isv010 = require('../../isv010.js');

/* Part of the zone-ification of the zlib built-in module.
 * Here make a minor change to the Zlib constructor, which is a base class for
 * different classes that implement a compression algorithms (Deflate, Gzip,
 * etc).
 */

var RealZlib = Zlib;

Zlib = function Zlib() {
  RealZlib.apply(this, arguments);

  if (isv010)
    this._binding.owner = this;
  else // Node 0.11+
    this._handle.owner = this;
};

Zlib.prototype = RealZlib.prototype;
