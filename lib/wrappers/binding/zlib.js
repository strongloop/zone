
module.exports = function(binding) {
  var util = require('util');

  var zlib = binding('zlib');
  var RealZlib = zlib.Zlib;

  function Zlib(a, b, c, d, e) {
    return (new RealZlib(a, b, c, d, e)).__init__();
  };

  patchPrototype(RealZlib.prototype);

  zlib.Zlib = Zlib;
  zlib.Zlib.prototype = RealZlib.prototype;

  return zlib;


  function patchPrototype(prototype) {
    // Constructor
    prototype.__init__ = function __init__() {
      this.__zone__ = global.zone;

      this._previousSibling = null;
      this._nextSibling = null;

      this.__released__ = false;

      this.__zone__._registerChild(this);
      return this;
    };

    // Write
    monkeypatchAsyncMethod(prototype, 'write');

    // Close
    var originalClose = prototype.close;

    prototype.close = function() {
      this.release();
      originalClose.call(this);
    };

    prototype.release = function release() {
      if (this.__released__)
        return;

      this.__released__ = true;
      this.__zone__._unregisterChild(this);
    };

    // Cleanup
    prototype.signal = function signal(error) {
      if (this.__closing__) {
        // Do nothing if the stream or server is already closing.
        return;
      }

      this.owner.close();
    };

    // Debugging
    prototype.dump = function dump(options) {
      var indent = options.indent || 0;
      var prefix = (new Array(indent + 1)).join('  ');

      return util.format('%s [%s] %s\n', prefix, 'Stream      ', 'Zlib');
    };
  }


  function monkeypatchAsyncMethod(prototype, methodName) {
    // Capture the original method
    var originalMethod = prototype[methodName];

    // If the original method doesn't exist, the handle type doesn't support this interface,
    // so we don't have to monkey patch.
    if (!originalMethod)
      return;

    // Replace the method by a wrapper.
    prototype[methodName] = function(/* ... */) {
      // Call the original method.
      var req = originalMethod.apply(this, arguments);

      // On failure, no callback will be made, so we don't have to register anything with the zone.
      if (!req)
        return req;

      // The binding layer will read the .callback property when the async method completes.
      // We must ensure that it will see our wrapper instead.
      req.__defineGetter__('callback', getBindingCallback);

      // When the user assigns .callback (which may happen in the future!) we must capture
      // the callback and make sure `restoreZoneAndCallCallback` can access it.
      req.__defineSetter__('callback', captureUserCallback);

      // Capture the completion zone, so `restoreZoneAndCallUserCallback` knows what zone to restore.
      req.__zone__ = global.zone; // Or this.__zone__ might also work?

      // Increment the zone reference count.
      req.__zone__._incrementScheduledTaskCount();

      return req;
    };
  }

  function captureUserCallback(callback) {
    this.__user_callback__ = callback;
  }

  function getBindingCallback() {
    return restoreZoneAndCallUserCallback;
  }

  function restoreZoneAndCallUserCallback(/*...*/) {
    var callback = this.__user_callback__;
    var callbackZone = this.__zone__;

    // Call/schedule the callback and un-register from the zone.
    callbackZone.apply(this, callback, arguments); // Or something like that

    // Decrement the zone reference count or unregister something.
    this.__zone__._decrementScheduledTaskCount();
  }
};
