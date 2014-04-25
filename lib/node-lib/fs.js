
var assert = require('assert');
var debug = require('../debuglog')('zone');
var Gate = zone.Gate;
var uid = require('../uid.js');

var fs = exports = module.exports = require('node:fs');

// Fd tracking: we need to track the zone and the registration ID
// for each fd opened, untrack them on close, and close them when
// signalled by a zone
function Fd(fd) {
  this.fd = fd;
  this.zone = zone;
  this.id = uid();

  zone.__register__(this);
}

Fd.prototype.signal = function fdSignal(err) {
  debug('Fd.signal:', {fd: this.fd, zone: this.name, id: this.id});
  // take care not to multiply close on multiple signals
  var fd = this.fd;
  if (err && fd) {
    delete this.fd;
    exports.close(fd);
  }
};

Fd.prototype.unregister = function fdUnregister() {
  if (this.zone) {
    this.zone.__unregister__(this);
    delete this.zone;
  }
};

var fdTracker = Object.create(null);

fdTracker.track = function fdTrack(fd) {
  debug('Fd.track:', fd);
  assert.equal(this[fd], null, 'zone: attempt to double track fd ' + fd);
  this[fd] = new Fd(fd);
};

fdTracker.unTrack = function fdUnTrack(fd) {
  debug('Fd.untrack:', fd);
  var child = this[fd];
  if (child) {
    child.unregister();
    delete this[fd];
  }
};

var realOpenSync = fs.openSync;
exports.openSync = function openSync() {
  var fd = realOpenSync.apply(fs, arguments);
  fdTracker.track(fd);
  return fd;
};

var realOpen = fs.open;
exports.open = Gate(function open(path, flags, /*mode, */ cb) {
  var gate = this;

  var args = Array.prototype.slice.call(arguments);
  var callback = args[args.length - 1];
  args[args.length - 1] = wrappedCallback;

  try {
    realOpen.apply(fs, args);
  } catch (err) {
    gate.close();
    throw err;
  }

  function wrappedCallback(err, fd) {
    if (!err)
      fdTracker.track(fd);

    gate.applyAsync(this, callback, arguments);
    gate.close();
  }
});

var realCloseSync = fs.closeSync;
exports.closeSync = function closeSync(fd) {
  fdTracker.unTrack(fd);
  return realCloseSync(fd);
};

var realClose = fs.close;
exports.close = Gate(function close(fd, cb) {
  var gate = this;
  fdTracker.unTrack(fd);
  realClose(fd, function() {
    if (cb)
      gate.applyAsync(this, cb, arguments);
    gate.close();
  });
});

var realStat = fs.stat;
exports.stat = Gate(function stat(file, cb) {
  var gate = this;
  realStat(file, function() {
    gate.applyAsync(this, cb, arguments);
    gate.close();
  });
});

var realRead = fs.read;
exports.read = Gate(function read() {
  var gate = this;

  var args = Array.prototype.slice.call(arguments);
//console.log(args);
  var callback = args[args.length - 1];
  args[args.length - 1] = wrappedCallback;

  try {
    realRead.apply(fs, args);
  } catch (err) {
    gate.close();
    throw err;
  }

  function wrappedCallback() {
    gate.applyAsync(this, callback, arguments);
    gate.close();
  }
});

// TODO(sam) read, write, ... some set of the basics.
