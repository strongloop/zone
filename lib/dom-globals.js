// XXX(sam) add .unref() to all handles
// XXX(sam) unit tests could perhaps enumerate all properties of real and
// monkey-patched objects, and confirm that its the same interface?

var Gate = zone.Gate;


var realSetTimeout = global.setTimeout;
var realClearTimeout = global.clearTimeout;

var realSetInterval = global.setInterval;
var realClearInterval = global.clearInterval;

var realSetImmediate = global.setImmediate;
var realClearImmediate = global.clearImmediate;


global.setTimeout = Gate(function setTimeout(cb, timeout) {
  var gate = this;

  var handle = realSetTimeout(function() {
    gate.schedule(cb);
    gate.close();
    handle = null;
  }, timeout);

  gate._clear = function() {
    if (!handle)
      return;
    realClearTimeout(handle);
    gate.close();
    handle = null;
  };

  gate.signal = function(error) {
    // Cancel the timer on error, unless the timeout was zero.
    if (!error || timeout === 0)
      return;

    this._clear();
  };
});


global.clearTimeout = function clearTimeout(gate) {
  gate._clear();
};


global.setInterval = Gate(function setInterval(cb, interval) {
  var gate = this;

  var handle = realSetInterval(function() {
    gate.schedule(cb);
  }, interval);

  gate._clear = function() {
    if (!handle)
      return;

    // Calling realClearTimeout may seem wrong here but it is in fact
    // intentional.
    handle._repeat = false;
    realClearTimeout(handle);

    gate.close();
    handle = null;
  };

  gate.signal = function(error) {
    // Cancel the interval timer on error.
    if (!error)
      return;

    this._clear();
  };
});


global.clearInterval = function clearInterval(gate) {
  gate._clear();
};


global.setImmediate = Gate(function setImmediate(cb, timeout) {
  var gate = this;

  var handle = realSetImmediate(function() {
    gate.schedule(cb);
    gate.close();
    handle = null;
  }, timeout);

  gate._clear = function() {
    if (!handle)
      return;
    realClearImmediate(handle);
    gate.close();
    handle = null;
  };
}, zone.root);


global.clearImmediate = function clearImmediate(gate) {
  gate._clear();
};
