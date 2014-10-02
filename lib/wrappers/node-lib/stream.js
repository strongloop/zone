%nativeSource;

exports = module.exports;

var isv010 = require('../../isv010.js');

/**
 * Monkey-patch Writable#write() and Duplex#wite() to run the callback in the
 * calling zone instead of the stream construction zone.
 * This only matters when the stream is corked, but it's important to do the
 * right thing always.
 */

var Duplex = exports.Duplex;
var Writable = exports.Writable;

var originalWrite = Writable.prototype.write;
var originalEnd = Writable.prototype.end;

Writable.prototype.write = function(chunk, encoding, cb) {
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (typeof cb !== 'function') return originalWrite.apply(this, arguments);
  return originalWrite.call(
      this, chunk, encoding,
      zone.bindCallback(this, cb, null, {name: 'Writable.write'}));
};
Duplex.prototype.write = Writable.prototype.write;

Writable.prototype.end = function(chunk, encoding, cb) {
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (typeof cb !== 'function') return originalEnd.apply(this, arguments);

  return originalEnd.call(
      this, chunk, encoding,
      zone.bindCallback(this, cb, null, {name: 'Writable.end'}));
};
Duplex.prototype.write = Writable.prototype.write;
