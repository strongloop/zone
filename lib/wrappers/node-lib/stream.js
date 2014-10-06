%nativeSource;

exports = module.exports;

var isv010 = require('../../isv010.js');

/**
 * Monkey-patch Writable#write() and Duplex#wite() to run the callback in the
 * calling zone instead of the stream construction zone.
 * This only matters when the stream is corked, but it's important to do the
 * right thing always.
 */

var Readable = exports.Readable;
var Writable = exports.Writable;
var Duplex = exports.Duplex;

var originalWrite = Writable.prototype.write;
var originalEnd = Writable.prototype.end;

Readable.prototype.pause = Duplex.prototype.pause =
    bindToStreamZone(Readable.prototype.pause);
Readable.prototype.resume = Duplex.prototype.resume =
    bindToStreamZone(Readable.prototype.resume);
Readable.prototype.read = Duplex.prototype.read =
    bindToStreamZone(Readable.prototype.read);

Writable.prototype.write = Duplex.prototype.write =
    bindWriteToStreamZone(Writable.prototype.write);
Writable.prototype.end = Duplex.prototype.end =
    bindWriteToStreamZone(Writable.prototype.end);

if (!isv010) {
  Writable.prototype.cork = Duplex.prototype.cork =
      bindToStreamZone(Writable.prototype.cork);
  Writable.prototype.uncork = Duplex.prototype.uncork =
      bindToStreamZone(Writable.prototype.uncork);
}


function bindToStreamZone(method) {
  return function() {
    if (!this._zone)
      this._zone = zone;

    if (this._zone !== zone)
      return applyZone(this._zone, this, method, arguments);
    else
      return method.apply(this, arguments);
  };
}


function bindWriteToStreamZone(method) {
  return function(chunk, encoding, cb) {
    if (typeof encoding === 'function') {
      arguments[2] = cb = encoding;
      arguments[1] = encoding = null;
    }

    if (!this._zone)
      this._zone = zone;

    if (this._zone !== zone &&
        typeof cb === 'function') {
      cb = zone.bindCallback(this,
                             cb,
                             this._zone,
                             { name: 'Stream.' + method.name });
      arguments[2] = cb;
    }

    if (this._zone !== zone)
      return applyZone(this._zone, this, method, arguments);
    else
      return method.apply(this, arguments);
  }
}


function applyZone(targetZone, self, fn, args) {
  var previousZone = zone;
  zone = targetZone;

  try {
    return fn.apply(self, args);
  } finally {
    zone = previousZone;
  }
}
