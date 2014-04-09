
module.exports = function(binding) {
  var Zone = zone.Zone;
  var Gate = zone.Gate;
  var util = require('util');

  var pipe_wrap = binding('pipe_wrap');
  var tcp_wrap = binding('tcp_wrap');
  var tty_wrap = binding('tty_wrap');

  patchPrototype(pipe_wrap.Pipe.prototype);
  patchPrototype(tcp_wrap.TCP.prototype);
  patchPrototype(tty_wrap.TTY.prototype);

  function Pipe() {
    return (new pipe_wrap.Pipe()).__init__();
  }

  function TCP() {
    return (new tcp_wrap.TCP()).__init__();
  }

  function TTY(fd, readable) {
    return (new tty_wrap.TTY(fd, readable)).__init__();
  }

  return {
    isTTY: tty_wrap.isTTY,
    guessHandleType: tty_wrap.guessHandleType,
    Pipe: Pipe,
    TCP: TCP,
    TTY: TTY
  };

  function patchPrototype(prototype) {
    // Construction-time initialization
    prototype.__init__ = function() {
      this.__zone__ = zone;
      this.__id__ = zone._register(null, this);

      this.__read_gate__ = null;
      this.__listen_gate__ = null;

      return this;
    };

    // Connect methods
    if (prototype.connect)
      prototype.connect = wrapRequestMethod(prototype.connect);
    if (prototype.connect6)
      prototype.connect6 = wrapRequestMethod(prototype.connect6);

    // Write methods
    if (prototype.writeBuffer)
      prototype.writeBuffer = wrapRequestMethod(prototype.writeBuffer);
    if (prototype.writeAsciiString)
      prototype.writeAsciiString = wrapRequestMethod(prototype.writeAsciiString);
    if (prototype.writeUtf8String)
      prototype.writeUtf8String = wrapRequestMethod(prototype.writeUtf8String);
    if (prototype.writeUcs2String)
      prototype.writeUcs2String = wrapRequestMethod(prototype.writeUcs2String);
    if (prototype.writev)
      prototype.writev = wrapRequestMethod(prototype.writev);

    // Read methods
    if (prototype.readStart) {
       var realReadStart = prototype.readStart;
       var realReadStop = prototype.readStop;

      function Read() {
      };

      function onRead() {
        return this.__read_gate__.call(this.__user_onread__, this, arguments);
      }

      function getBindingOnRead() {
        return onRead;
      }

      function setUserOnRead(value) {
        this.__user_onread__ = value;
      }

      prototype.readStart = function() {
        if (this.__read_gate__)
          this.__read_gate__.close();

        this.__read_gate__ = new Gate(Read);

        return realReadStart.apply(this, arguments);
      };

      prototype.readStop = function() {
        if (this.__read_gate__)
          this.__read_gate__.close();

        this.__read_gate__ = null;

        return realReadStop.apply(this, arguments);
      };

      Object.defineProperty(prototype, 'onread', {
        get: getBindingOnRead,
        set: setUserOnRead
      });
    }

    // Listen/accept methods
    if (prototype.listen) {
      var realListen = prototype.listen;

      function Listen() {
      };

      function onConnection(err, clientHandle) {
        // Temporarily enter the server zone and then init the client
        // handle, so it gets registered to the server zone too.
        zone = this.__zone__;
        clientHandle.__init__();

        return this.__listen_gate__.call(this.__user_onconnection__, this, arguments);
      }

      function getBindingOnConnection() {
        return onConnection;
      }

      function setUserOnConnection(value) {
        this.__user_onconnection__ = value;
      }

      prototype.listen = function(/* backlog */) {
        if (this.__listen_gate__)
          this.__listen_gate__.close();

        this.__listen_gate__ = new Gate(Listen);

        return realListen.apply(this, arguments);
      };

      Object.defineProperty(prototype, 'onconnection', {
        get: getBindingOnConnection,
        set: setUserOnConnection
      });
    }

    // Close
    var realClose = prototype.close;

    prototype.close = function(cb) {
      function Close() {
      }

      function OnClose() {
        if (this.__read_gate__)
          this.__read_gate__.close();

        if (this.__listen_gate__)
          this.__listen_gate__.close();

        if (cb)
          gate.call(cb, this, arguments);

        gate.close();

        this.__zone__._unregister(this.__id__);
      }

      var gate = new Gate(Close);

      realClose.call(this, OnClose);
    };

    // Bookkeeping
    prototype.signal = function(error) {
      // TODO: implement me
    };

    // Debugging
    prototype._dump = function(options) {
      var indent = options.indent || 0;
      var active = !!(this.__read_gate__ || this.__listen_gate__);
      var prefix = (new Array(indent + 1)).join('  ');

      var sockName = {};
      if (this.getsockname)
        this.getsockname(sockName);

      var peerName = {};
      if (this.getpeername)
        this.getpeername(peerName);

      var address = '';
      if (sockName.address)
        address = '' + sockName.address + ':' + sockName.port;
      if (peerName.address)
        address += ' <=> ' + peerName.address + ':' + peerName.port;
      if (address)
        address = ' (' + address + ')';

      return util.format('%s%s%s handle #%d%s\n',
                         prefix,
                         active ? '+' : ' ',
                         this.constructor.name,
                         this.__id__,
                         address);
    };
  }

  function wrapRequestMethod(baseMethod) {
    return function(req) {
      var wrap = this;
      var args = arguments;
      var result;

      new Gate(function ReqGate() {
        var realOncomplete = req.oncomplete;
        req.oncomplete = wrappedOncomplete;
        var gate = this;
        gate.name = baseMethod.name || 'Stream request';

        result = baseMethod.apply(wrap, args);

        function wrappedOncomplete() {
          arguments[1] = wrap;
          gate.call(realOncomplete, wrap, arguments);
          gate.close();
        }
      });

      return result;
    };
  }
};
