
var assert = require('assert');
var debug = require('../debuglog')('zone');
var fs = require('node:fs');
var Gate = zone.Gate;

// Copy properties over from the real fs module.
for (var key in fs)
  exports[key] = fs[key];

// Fd tracking: we need to track the zone and the registration ID
// for each fd opened, untrack them on close, and close them when
// signalled by a zone
function Fd(fd) {
  this.fd = fd;
  this.zone = zone;
  this.id = zone._register(null, this);
}

Fd.prototype.signal = function fdSignal() {
  debug('Fd.signal:', {fd:this.fd, zone:this.name, id:this.id});
  // take care not to multiply close on multiple signals
  var fd = this.fd;
  if(fd) {
    delete this.fd;
    exports.close(fd);
  }
};

Fd.prototype.unregister = function fdUnregister() {
  if(this.zone) {
    this.zone._unregister(this.id);
    delete this.zone;
  }
};

var fdTracker = Object.create(null);

fdTracker.track = function fdTrack(fd) {
  debug('Fd.track:',fd);
  assert.equal(this[fd], null, 'zone: attempt to double track fd '+fd);
  this[fd] = new Fd(fd);
};

fdTracker.unTrack = function fdUnTrack(fd) {
  debug('Fd.untrack:',fd);
  var child = this[fd];
  if (child) {
    child.unregister();
    delete this[fd];
  }
};

exports.openSync = function openSync() {
  var fd = fs.openSync.apply(fs, arguments);
  fdTracker.track(fd);
  return fd;
};

exports.open = Gate(function open(path, flags, /*mode, */ cb) {
  // TODO(sam) check the node fs.open optional arg munging algorithm
  var gate = this;
  fs.open(path, flags, function(err, fd) {
    if(!err) {
      // At this point, zone === Root, we need fd to be tracked as a child of
      // the target, not Root, so schedule the tracking in the target.
      gate.schedule(fdTracker.track, fdTracker, [fd]);
    }
    gate.schedule(cb, this, arguments);
    gate.close();
  });
});

exports.closeSync = function closeSync(fd) {
  fdTracker.unTrack(fd);
  return fs.closeSync(fd);
};

exports.close = Gate(function close(fd, cb) {
  var gate = this;
  fs.close(fd, function() {
    fdTracker.unTrack(fd);
    gate.schedule(cb, this, arguments);
    gate.close();
  });
});

exports.stat = Gate(function stat(file, cb) {
  var gate = this;
  fs.stat(file, function() {
    gate.schedule(cb, this, arguments);
    gate.close();
  });
});

// TODO(sam) read, write, ... some set of the basics.
