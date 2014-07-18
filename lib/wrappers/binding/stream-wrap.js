module.exports = function(binding) {
  var Zone = zone.Zone;
  var Gate = zone.Gate;
  var uid = require('../../Uid.js');
  var util = require('util');

  var pipe_wrap = binding('pipe_wrap');
  var tcp_wrap = binding('tcp_wrap');
  var tty_wrap = binding('tty_wrap');

  patchPrototype(pipe_wrap.Pipe.prototype);
  patchPrototype(tcp_wrap.TCP.prototype);
  patchPrototype(tty_wrap.TTY.prototype);

  function Pipe() { return (new pipe_wrap.Pipe()).__init__(); }

  function TCP() { return (new tcp_wrap.TCP()).__init__(); }

  function TTY(fd, readable) {
    return (new tty_wrap.TTY(fd, readable)).__init__(fd);
  }

  return {
    isTTY: tty_wrap.isTTY,
    guessHandleType: tty_wrap.guessHandleType,
    Pipe: Pipe,
    TCP: TCP,
    TTY: TTY
  };

  function patchPrototype(prototype) {
    prototype.__init__ = function __init__(fd) {
      this.__fd__ = fd;
      this.__zone__ = zone;

      /**
       * A pointer to the previous sibling zone or delegate within the
       * parent zone
       * @ private
       */
      this._previousSibling = null;

      /**
       * A pointer to the next sibling zone or delegate within the parent
       * zone
       * @ private
       */
      this._nextSibling = null;

      this.__released = false;

      // FDs <= 2 are un-closable, so their handles should be cleaned up
      // last.
      if (fd === 'number' && fd <= 2) {
        this.__zone__ = zone.root;
      }
      this.__zone__._registerChild(this);

      if (prototype.readStart) {
        this.__init_read__();
      }
      if (prototype.writeBuffer) {
        this.__init_write__();
      }
      return this;
    };

    if (prototype.open) {
      var realOpen = prototype.open;

      prototype.open = function(fd) {
        // Delegate to the binding layer first, so if open fails we can
        // immediately bail out.
        var result = realOpen.apply(this, arguments);
        if (result < 0) return result;

        // Open succeeded.
        this.__fd__ = fd;

        // FDs <= 2 are un-closable, so their handles should be cleaned up last.
        if (fd === 'number' && fd <= 2) {
          this.__zone__ = zone.root;
        }

        // Re-register if this is a non-closable fd.
        this.__zone__._unregisterChild(this);
        this.__zone__._registerChild(this);

        return result;
      };
    }

    // Close
    var realClose = prototype.close;
    prototype.close = function close(cb) {
      if (this.__close_cb__) {
        throw new Error('Handle is already closing or closed.');
      }

      this.closed = true;
      if (cb) {
        this.__close_cb__ =
            this.__zone__.bindAsyncCallback(this, cb, null);
      }
      realClose.call(this, OnClose);
    };

    function OnClose() {
      if (this.__onread_cb__) {
        this.__zone__.releaseCallback(this.__onread_cb__);
      }
      if (this.__onwrite_cb__) {
        this.__zone__.releaseCallback(this.__onwrite_cb__);
      }
      if (this.__onconnection_cb__) {
        this.__zone__.releaseCallback(this.__onconnection_cb__);
      }

      if (this.__close_cb__) {
        this.__close_cb__.apply(this, arguments);
        this.__close_cb__ = null;
      }
      this.__zone__._unregisterChild(this);
    };

    // Listen/accept methods
    if (prototype.listen) {
      function onConnection(err, clientHandle) {
        // Temporarily enter the server zone and then init the client handle,
        // so it gets registered to the server zone too.
        var curZone = zone;
        zone = this.__zone__;
        clientHandle.__init__();
        zone = curZone;

        return this.__onconnection_cb__.apply(this, arguments);
      };

      function getWrappedOnConnection() { return onConnection; };

      function setOnConnectionCallback(cb) {
        var self = this;
        var callbackSignalHandler = function(err) {
          if (!err) {
            return;
          }
          self.signal(err);
        };
        this.__onconnection_cb__ =
            this.__zone__.bindAsyncCallback(this, cb, null, {
              autoRelease: false,
              signalCallback: callbackSignalHandler,
              name: 'OnConnection'
            });
      };

      Object.defineProperty(
          prototype, 'onconnection',
          {
            get: getWrappedOnConnection,
            set: setOnConnectionCallback
          });
    }

    // Connect methods
    if (prototype.connect)
      prototype.connect = wrapRequestMethod(prototype.connect);
    if (prototype.connect6)
      prototype.connect6 = wrapRequestMethod(prototype.connect6);

    function wrapRequestMethod(baseMethod) {
      return function(req) {
        var realOnComplete = req.oncomplete;
        req.oncomplete = this.__zone__.bindAsyncCallback(
            this, realOnComplete, null);
        return baseMethod.apply(this, arguments);
      };
    }

    // Write methods
    if (prototype.writeBuffer) {
      prototype.writeBuffer = wrapWriteMethod(prototype.writeBuffer);
    }
    if (prototype.writeAsciiString) {
      prototype.writeAsciiString = wrapWriteMethod(prototype.writeAsciiString);
    }
    if (prototype.writeUtf8String) {
      prototype.writeUtf8String = wrapWriteMethod(prototype.writeUtf8String);
    }
    if (prototype.writeUcs2String) {
      prototype.writeUcs2String = wrapWriteMethod(prototype.writeUcs2String);
    }
    if (prototype.writev) {
      prototype.writev = wrapWriteMethod(prototype.writev);
    }

    // Shutdown
    if (prototype.shutdown) {
      prototype.shutdown = wrapWriteMethod(prototype.shutdown);
    }

    prototype.__init_write__ = function() {
      this.__onwrite_cb__ = this.__zone__.bindAsyncCallback(
          this, OnWriteComplete, null,
          {autoRelease: false, name: 'OnWrite'});
    };

    function OnWriteComplete(req, args) {
      // this = req
      req.__oncomplete__.apply(req, args);
      req.oncomplete = null;
    };

    function wrapWriteMethod(baseMethod) {
      return function(req) {
        req.__oncomplete__ = req.oncomplete;
        var __onwrite_cb__ = this.__onwrite_cb__;
        req.oncomplete = function() {
          __onwrite_cb__(this, arguments);
        };

        var result = baseMethod.apply(this, arguments);
        if (result < 0 || req.async === false) {
          req.oncomplete = null;
          req.__oncomplete__ = null;
        }
        return result;
      };
    };

    // Read methods
    if (prototype.readStart) {
      var realReadStart = prototype.readStart;
      var realReadStop = prototype.readStop;

      prototype.__init_read__ = function() {
        this.__onread_user_cb__ = null;
        var self = this;
        var callbackSignalFunc = function(err) {
          if (!err && !self.__released) {
            return;
          }
          self.readStop();

          if (!self.__released) {
            self.signal(err);
          }else {
            this.release();
          }
        };

        this.__onread_cb__ =
            this.__zone__.bindAsyncCallback(this, OnRead, null, {
              autoRelease: false,
              signalCallback: callbackSignalFunc,
              name: 'OnRead'
            });
      };

      function OnRead() {
        if (this.__onread_user_cb__) {
          this.__onread_user_cb__.apply(this, arguments);
        }
      };

      function getWrappedOnRead() {
        if (this.__onread_user_cb__) {
          return this.__onread_cb__;
        }
        return null;
      };

      function setOnReadCallback(cb) {
        this.__onread_user_cb__ = cb;
      };

      prototype.readStop = function() {
        if (this.__onread_user_cb__) {
          this.__onread_user_cb__ = null;
        }
        return realReadStop.apply(this, arguments);
      };

      Object.defineProperty(prototype, 'onread',
                            {get: getWrappedOnRead, set: setOnReadCallback});
    }

    // Cleanup
    prototype.signal = function signal(error) {
      // Of course we could use the handle's close() method here, but then the
      // lib wrappers would never know about it. Therefore the close call is
      // routed through the lib wrapper. This must be either a net.Server that
      // exposes .close(), or a net.Socket that exposes .destroy().
      // However don't try to close stdio handles because they throw.
      var owner = this.owner;

      if (this.__fd__ === null || this.__fd__ == undefined || this.__fd__ > 2) {
        if (owner.close) {
          return owner.close();
        }else if (owner.writable && owner.destroySoon) {
          owner.destroySoon();
          this.release();
        }else {
          owner.destroy();
        }
      } else if (this.__fd__ >= 0 && this.__fd__ <= 2) {
        //STD in/out/err streams. Just mark them released
        this.release();
      }
    };

    prototype.release = function release() {
      this.__released = true;
      this.__zone__._unregisterChild(this);
    };

    prototype.dump = function dump(options) {
      var indent = options.indent || 0;
      var prefix = (new Array(indent + 1)).join('  ');

      var sockName = {};
      if (this.getsockname) this.getsockname(sockName);

      var peerName = {};
      if (this.getpeername) this.getpeername(peerName);

      var address = '';
      if (sockName.address) {
        address += sockName.address + ':' + sockName.port;
      }
      if (peerName.address) {
        address += ' <=> ' + peerName.address + ':' + peerName.port;
      }
      if (this.__fd__ != null) {
        address += (address && ', ') + 'fd: ' + this.__fd__;
      }
      if (address) {
        address = ' (' + address + ')';
      }

      var type;
      if (this.__onconnection_cb__) {
        type = this.constructor.name + ' server';
      }else if (this.constructor !== TCP) {
        type = this.constructor.name + ' handle';
      }else {
        type = 'TCP socket';
      }

      return util.format('%s [%s] %s %s\n',
          prefix, 'Stream      ', type, address);
    };
  };
};
