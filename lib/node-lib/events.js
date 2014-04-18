// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var domain;
var util = require('util');
var Gate = zone.Gate;

function EventEmitter() {
  EventEmitter.init.call(this);
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.usingDomains = false;

EventEmitter.prototype.domain = undefined;
EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;
// ZONE
EventEmitter.prototype._zone = undefined;
EventEmitter.prototype._gates = undefined;
EventEmitter.prototype._crossZone = false;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

EventEmitter.init = function() {
  this.domain = null;
  if (EventEmitter.usingDomains) {
    // if there is an active domain, then attach to it.
    domain = domain || require('domain');
    if (domain.active && !(this instanceof domain.Domain)) {
      this.domain = domain.active;
    }
  }

  if (!this._events || this._events === Object.getPrototypeOf(this)._events)
    this._events = {};

  this._maxListeners = this._maxListeners || undefined;

  // ZONE: capture current zone.
  zoneInit(this);
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!util.isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  // ZONE: check for cross-zoning constraints.
  zoneCheck(this);

  if (!this._events)
    this._events = {};

  // ZONE: call handlers from the construction zone.
  var previousZone = zone;
  zone = this._zone;

  try {
    // If there is no 'error' event listener then throw.
    if (type === 'error' && !this._events.error) {
      er = arguments[1];
      if (this.domain) {
        if (!er)
          er = new Error('Uncaught, unspecified "error" event.');
        er.domainEmitter = this;
        er.domain = this.domain;
        er.domainThrown = false;
        this.domain.emit('error', er);
      } else if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw Error('Uncaught, unspecified "error" event.');
      }
      return false;
    }

    handler = this._events[type];

    if (util.isUndefined(handler))
      return false;

    if (this.domain && this !== process)
      this.domain.enter();

    if (util.isFunction(handler)) {
      switch (arguments.length) {
        // fast cases
        case 1:
          handler.call(this);
          break;
        case 2:
          handler.call(this, arguments[1]);
          break;
        case 3:
          handler.call(this, arguments[1], arguments[2]);
          break;
        // slower
        default:
          len = arguments.length;
          args = new Array(len - 1);
          for (i = 1; i < len; i++)
            args[i - 1] = arguments[i];
          handler.apply(this, args);
      }
    } else if (util.isObject(handler)) {
      len = arguments.length;
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];

      listeners = handler.slice();
      len = listeners.length;
      for (i = 0; i < len; i++)
        listeners[i].apply(this, args);
    }

    if (this.domain && this !== process)
      this.domain.exit();

    return true;

  } finally {
    // ZONE: restore the caller zone.
    zone = previousZone;
  }
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!util.isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // ZONE: check for cross-zoning constraints.
  zoneCheck(this);

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              util.isFunction(listener.listener) ?
              listener.listener : listener);

  // ZONE: the listener is added from another zone, wrap it in a gate.
  if (zone !== this._zone)
    listener = zoneWrapListener(this, listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (util.isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (util.isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!util.isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!util.isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!util.isFunction(listener))
    throw TypeError('listener must be a function');

  // ZONE: check for cross-zoning constraints.
  zoneCheck(this);

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (util.isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    // ZONE: clean the zone wrapper.
    zoneRemoveWrappedListener(this, listener);
    if (this._events.removeListener) {
      this.emit('removeListener', type, listener);
    }

  } else if (util.isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    // ZONE: clean the zone wrapper.
    zoneRemoveWrappedListener(this, listener);

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  // ZONE: check for cross-zoning constraints.
  zoneCheck(this);

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0) {
      // ZONE: remove the wrappers for every cross-zone listener.
      zoneRemoveAllWrappedListeners(this);
      this._events = {};
    } else if (this._events[type])
      // ZONE: remove the wrappers for every cross-zone listener.
      zoneRemoveAllWrappedListeners(this, type);
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    // ZONE: remove the wrappers for every cross-zone listener.
    zoneRemoveAllWrappedListeners(this);
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (util.isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (Array.isArray(listeners)) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (util.isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (util.isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};


// ZONE methods

function zoneInit(emitter) {
  // Store the zone in which this EventEmitter was constructed.
  emitter._zone = zone;
  // If EventEmitter.init() is called at the right time, this emitter can be
  // used across multiple zones.
  emitter._crossZone = true;
  // Gates that allow .emit() to enter other zones.
  emitter._gates = {};
}

function zoneCheck(emitter) {
  if (emitter._zone && emitter._crossZone) {
    // Normal case: this EventEmitter was initialized by zoneInit, hence can
    // be used across multiple zones. Check if the active zone is the same or a
    // child zone of the constructor zone.
    // TODO: improve error message.
    if (zone !== emitter._zone && !zone.childOf(emitter._zone))
      throw new Error("Only the construction zone and it's child zone can interact with " +
                      'this EventEmitter.');

  } else if (emitter._zone && !emitter._crossZone) {
    // Compatibility: sometimes libraries inherit from EventEmitter but they
    // omit calling the EventEmitter constructor from the subclass constructor.
    // In these cases we can't capture the construction zone so we disallow
    // using the EventEmitter across zones.
    if (zone !== emitter._zone)
      throw new Error("Only one zone can interact with this zone but you're " +
                      'not in it. You can wim more freedom by calling the ' +
                      'EventEmitter() constructor properly.');

  } else {
    // See the previous case. This EventEmitter is used for the first time, so
    // lazily capture the zone but clear the _crossZone flag.
    emitter._zone = zone;
    emitter._crossZone = false;
  }
}

function noop() {
}

function zoneWrapListener(emitter, listener) {
  var gates = emitter._gates;
  var gate = gates[zone.id];

  if (!gate) {
    gate = new Gate(noop, emitter._zone);
    gate.count = 1;
    gates[zone.id] = gate;
  } else {
    gate.count++;
  }

  function w() {
    gate.apply(this, listener, arguments);
  }

  w.listener = util.isFunction(listener.listener) ?
      listener.listener : listener;
  w.zone = zone;

  return w;
}

function zoneRemoveWrappedListener(emitter, listener) {
  var zone = listener.zone;
  var gates = emitter._gates;

  if (!zone)
    return;

  var gate = gates[zone.id];

  if (gate.count > 1) {
    gates[zone.id]--;
  } else {
    delete gates[zone.id];
  }
}

function zoneRemoveAllWrappedListeners(emitter, type) {
  var events = emitter._events;

  if (arguments.length === 1) {
    for (key in events)
      zoneRemoveAllWrappedListeners(emitter, key);
    return;
  }

  var list = emitter[type];

  if (list === listener ||
     (util.isFunction(list.listener) && list.listener === listener)) {
    zoneRemoveWrappedListener(emiiter, list);
  } else if (util.isObject(list)) {
    for (var i = list.length - 1; i >= 0; i--)
      zoneRemoveWrappedListener(emitter, list[i]);
  }
}
