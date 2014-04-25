
module.exports = function(binding) {
  var assert = require('assert');
  var uid = require('../uid.js');
  var util = require('util');

  var Zone = zone.Zone;
  var Gate = zone.Gate;

  var fs = binding('fs');

  // Opening and closing a file descriptor
  fs.open = wrapOpen(fs.open);
  fs.close = wrapClose(fs.close);

  // Operations targeting a file descriptor
  fs.fchmod = wrap(fs.fchmod, 'fs.fchmod', 2);
  fs.fchown = wrap(fs.fchown, 'fs.fchown', 3);
  fs.fdatasync = wrap(fs.fdatasync, 'fs.fdatasync', 1);
  fs.read = wrap(fs.read, 'fs.read', 5);
  fs.writeBuffer = wrap(fs.writeBuffer, 'fs.write', 5);
  fs.writeString = wrap(fs.writeString, 'fs.write', 4);
  fs.fstat = wrap(fs.fstat, 'fs.fstat', 1);
  fs.fsync = wrap(fs.fsync, 'fs.fsync', 1);
  fs.ftruncate = wrap(fs.ftruncate, 'fs.ftruncate', 2);
  fs.futimes = wrap(fs.futimes, 'fs.futimes', 3);

  // Operations targeting a path
  fs.stat = wrap(fs.stat, 'fs.stat', 1);
  fs.link = wrap(fs.link, 'fs.link', 2);
  fs.lstat = wrap(fs.lstat, 'fs.lstat', 1);
  fs.chmod = wrap(fs.chmod, 'fs.chmod', 2);
  fs.chown = wrap(fs.chown, 'fs.chown', 3);
  fs.rename = wrap(fs.rename, 'fs.rename', 2);
  fs.readlink = wrap(fs.readlink, 'fs.readlink', 1);
  fs.readdir = wrap(fs.readdir, 'fs.readdir', 1);
  fs.unlink = wrap(fs.unlink, 'fs.unlink', 1);
  fs.symlink = wrap(fs.symlink, 'fs.symlink', 3);
  fs.utimes = wrap(fs.utimes, 'fs.utimes', 3);

  // TODO: wrap stat watcher


  // The FDTracker class tracks open files and auto-closes them when the zone
  // that opened the file exits.
  function FDTracker(fd, path) {
    this.fd = fd;
    this.path = path;

    this.id = uid();
    this.zone = zone;

    this.zone.__register__(this);
  };

  FDTracker.prototype.destroy = function() {
    this.zone.__unregister__(this);
  };

  FDTracker.prototype.signal = function() {
    fs.close(this.fd);
  };

  FDTracker.prototype._dump = function(options) {
      var indent = options.indent || 0;
      var prefix = (new Array(indent + 1)).join('  ');

      return util.format('%s File #%d (fd: %d, path: %s)\n',
                         prefix,
                         this.id,
                         this.fd,
                         this.path);
  };

  FDTracker.table = [];

  FDTracker.register = function(fd, path) {
    assert(this.table[fd] === undefined);
    this.table[fd] = new FDTracker(fd, path);
  };

  FDTracker.unregister = function(fd) {
    var fdTracker = this.table[fd];
    assert(fdTracker);
    fdTracker.destroy();
    delete this.table[fd];
  };


  // 'Open' method wrapper generator.
  function wrapOpen(open) {
    return function(path, flags, mode, callback) {
      // If no callback was specified then call the synchronous binding.
      if (typeof callback !== 'function') {
        try {
          var fd = -1;
          return fd = open(path, flags, mode);

        } finally {
          // If open succeeded, add the FD to the tracker.
          if (fd >= 0)
            FDTracker.register(fd, path);
        }
      }

      var result, error;

      // If open was called asynchronously, construct a Gate.
      var gate = new Gate(function() {
        this.name = 'fs.open';

        // (Try to) call the wrapped method. FS methods can fail either by
        // throwing or by returning a value < 0; in neither case the callback
        // will be called.
        try {
          result = open(path, flags, mode, wrappedOpenCallback);
        } catch (err) {
          error = err;
        }
      });

      if (error || result < 0)
        gate.close();

      if (error)
        throw error;
      else
        return result;

      // Trampoline that schedules the user callback and then
      // closes the gate.
      function wrappedOpenCallback(err, fd) {
        // If open succeeded, add the FD to the tracker. Use gate.run so the
        // file descripter gets registered to the right zone.
        if (!err && fd >= 0)
          gate.call(FDTracker, FDTracker.register, fd, path);

        gate.applyAsync(this, callback, arguments);
        gate.close();
      }
    };
  }

  // 'close' method wrapper generator.
  function wrapClose(close) {
    return function(fd, callback) {
      // Unregister the file descriptor from the tracker.
      FDTracker.unregister(fd);

      // If no callback was specified then call the synchronous binding.
      if (typeof callback !== 'function')
        return close.apply(this, arguments);

      var result, error;

      // If close was called asynchronously, construct a Gate.
      var gate = new Gate(function() {
        this.name = 'fs.close';

        // (Try to) call the wrapped method. FS methods can fail either by
        // throwing or by returning a value < 0; in neither case the callback
        // will be called.
        try {
          result = close(fd, wrappedCloseCallback);
        } catch (err) {
          error = err;
        }
      });

      if (error || result < 0)
        gate.close();

      if (error)
        throw error;
      else
        return result;

      // Trampoline that schedules the user callback and then
      // closes the gate.
      function wrappedCloseCallback(err) {
        gate.applyAsync(this, callback, arguments);
        gate.close();
      }
    }
  }

  // Generic method wrapper generator.
  function wrap(method, name, callbackPosition) {
    return function() {
      // Capture the original arguments and the callback.
      var args = arguments;
      var callback = args[callbackPosition];

      // If the method is called synchronously, call the binding directly.
      if (typeof callback !== 'function')
        return method.apply(this, args);

      // The result of the method call.
      var error, result;

      // If the method is called asynchronously, construct a Gate.
      var gate = new Gate(function() {
        // Set the gate's name to something more descriptive.
        this.name = name;

        // Patch the callback so it now no longer points at the user-specified
        // callback, but at ours instead.
        args[callbackPosition] = wrappedCallback;

        // (Try to) call the wrapped method. FS methods can fail either by
        // throwing or by returning a value < 0; in neither case the callback
        // will be called.
        try {
          result = method.apply(fs, args);
        } catch (err) {
          error = err;
        }
      });

      if (error || result < 0)
        gate.close();

      if (error)
        throw error;
      else
        return result;

      // Trampoline that schedules the user callback and then
      // closes the gate.
      function wrappedCallback() {
        gate.applyAsync(this, callback, arguments);
        gate.close();
      }
    };
  }


  // Return the binding object with relevant methods wrapped.
  return fs;
};
