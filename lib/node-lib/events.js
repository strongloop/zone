
module.exports = EventEmitter;
module.exports.EventEmitter = EventEmitter;


var Gate = zone.Gate;


function EventEmitter() {
  // Capture the zone in which this EE got constructed.
  var self = this;
  var zone = global.zone;

  var listeners = Object.create(null);

  self.addListener = Gate(function(event, callback) {
    var gate = this;
    gate.name = 'Listener(' + event + ')';
    gate.callback = callback;
    gate.once = false;

    if (listeners[event] === undefined)
      listeners[event] = [];

    listeners[event].push(gate);
  }, zone);

  self.on = self.addListener;

  self.once = Gate(function(event, callback) {
    var gate = this;
    gate.name = 'OnceListener(' + event + ')';
    gate.callback = callback;
    gate.once = true;

    if (listeners[event] === undefined)
      listeners[event] = [];

    listeners[event].push(gate);
  }, zone);

  self.removeListener = function(event, callback) {
    var list = listeners[event];

    for (var i = 0; i < list.length; i++) {
      var gate = list[i];

      if (gate.callback === callback) {
        gate.close();
        list.splice(i, 1);
        break;
      }
    }
  };

  self.emit = function(event) {
    var args = Array.prototype.slice.call(arguments, 1);

    var list = (listeners[event] || []).slice();

    for (var i = 0; i < list.length; i++) {
      var gate = list[i];

      // TODO: it'd be better if any evnet that crosses zone boundaries is always made async?
      gate.call(gate.callback, self, args);

      if (gate.once)
        self.removeListener(event, gate.callback);
    }
  };

  self.removeAllListeners = function(event) {
    if (event === undefined) {
      for (event in listeners)
        self.removeAllListeners(event);
      return;
    }

   var list = listeners[event];

   for (var i = 0; i < list.length; i++)
     self.removeListener(list[i].callback);
  };
}
