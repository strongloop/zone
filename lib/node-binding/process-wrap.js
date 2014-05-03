
module.exports = function(binding) {
  var Zone = zone.Zone;
  var Gate = zone.Gate;

  var constants = require('constants');
  var uid = require('../uid.js');
  var util = require('util');

  var process_wrap = binding('process_wrap');

  patchPrototype(process_wrap.Process.prototype);

  function Process() {
    return (new process_wrap.Process()).__init__();
  }

  return {
    Process: Process
  };

  function patchPrototype(prototype) {
    // Construction-time initialization
    prototype.__init__ = function() {
      this.__zone__ = zone;
      this.__id__ = uid();

      this.__exit_gate__ = null;

      zone.__register__(this);

      return this;
    };

    // Spawn/Exit
    var realSpawn = prototype.spawn;

    function Exit() {}

    function onExit() {
      this.__exit_gate__.applyAsync(this, this.__user_onexit__, arguments);
      this.__exit_gate__.close();
      this.__exit_gate__ = null;
    }

    function getBindingOnExit() {
      return onExit;
    }

    function setUserOnExit(value) {
      this.__user_onexit__ = value;
    }

    prototype.spawn = function(options) {
      if (this.__exit_gate__)
        throw new Error('Process is already running');

      if (!options || typeof options !== 'object')
        throw new TypeError('options is not an object');

      this.__file__ = options.file;
      this.__killSignal__ = options.killSignal;

      this.__exit_gate__ = new Gate(Exit);
      this.__exit_gate__.signal = exitSignal.bind(this);
      this.__exit_gate__._dump = hiddenFromInspect;

      return realSpawn.apply(this, arguments);
    };

    function exitSignal(error) {
      if (!error)
        return;

      // Coerce the kill signal to a 32-bit integer.
      var killSignal = ~~this.__killSignal__;

      // Try to kill the process with the kill signal.
      if (killSignal && this.kill(killSignal) >= 0)
        return;

      // If the kill signal didn't work, try with SIGKILL.
      var r = this.kill(constants.SIGKILL);
    };

    Object.defineProperty(prototype, 'onexit', {
      get: getBindingOnExit,
      set: setUserOnExit
    });

    // Close
    var realClose = prototype.close;

    prototype.close = function() {
      this.__zone__.__unregister__(this);

      // Process#close doesn't take a callback.
      realClose.call(this);
    };

    // Cleanup
    prototype.signal = function() {
      // Nothing to do here. The lib layer should always close the process
      // handle after receiving the exit signal.
    };

    // Debugging
    prototype._dump = function(options) {
      var indent = options.indent || 0;
      var prefix = (new Array(indent + 1)).join('  ');
      var active = this.__exit_gate__ ? '+' : ' ';

      var info;
      if (typeof this.pid === 'number')
        info = util.format(' (%s, pid: %d)', this.__file__, this.pid);
      else
        info = '';

      return util.format('%s%sChild Process #%d%s\n',
                         prefix,
                         active,
                         this.__id__,
                         info);
    };

    function hiddenFromInspect() {
      return '';
    }
  }
};
