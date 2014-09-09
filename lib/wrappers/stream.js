var Duplex = require('_stream_duplex');
var Writable = require('_stream_writable');

/**
 * Monkey-patch Writable#write() and Duplex#wite() to run the callback in the
 * calling zone instead of the stream construction zone.
 * This only matters when the stream is corked, but it's important to do the
 * right thing always.
 */

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
