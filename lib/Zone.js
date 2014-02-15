exports.RootZone = RootZone;
exports.Zone = Zone;


var assert = require('assert');
var debug = require('debuglog')('zone');
var Gate = require('./Gate.js');
var nextTick = process.nextTick;
var uid = require('./uid.js');
var util = require('util');


var isConstructingRootZone = false;


function createBoundZoneConstructor(body, options, callback) {
  return function() {
    var args = arguments;

    function wrappedBody() {
      return body.apply(this, args);
    }

    return new Zone(wrappedBody, options, callback);
  }
}


/*
 * - body: runs in zone
 * - options: optional, none
 *   - name: {String} the zone name, defaults to the name of the `body`
 *     function, and if the body is anonymous, the zone's name is 'Anonymous'
 * - callback: optional, alternative to setCallback()
 *
 * @return:
 *
 * - When called as a constructor, body will be run in context of zone, and
 *   zone returned
 * - When called as a function, a wrap function will be returned. When the wrap
 *   function is called, a new zone will be constructed, and body will be passed
 *   the aguments of the wrap function.
 */
function Zone(body, options, callback) {
  assert(typeof body === 'function' || isConstructingRootZone);

  if (callback === undefined && typeof options === 'function') {
     callback = options;
     options = undefined;
  }

  options = util._extend({}, options);

  if (callback == null)
    callback = null;
  else
    assert(typeof callback === 'function');

  options.name = options.name || (body && body.name) || 'Anonymous';

  // Because the Zone constructor is accessible as a property on every zone
  // instance, the instanceof check doesn't suffice. Sometimes `this` may refer
  // to a zone even if Zone isn't used as a constructor. Therefore we also
  // check whether `this` has been fully constructed by checking if it has its
  // `id` property set.
  if (!(this instanceof Zone) || this.hasOwnProperty('id'))
    return createBoundZoneConstructor(body, options, callback);

  var id = uid();
  var self = this;
  var isRoot = isConstructingRootZone;

  if (isRoot)
    var parent = null;
  else
    var parent = zone;

  var result = undefined;
  var error = null;

  var children = Object.create(null);
  var refs = Object.create(null);
  var sentSignals = Object.create(null);

  var callbackQueue = [];
  var refCount = 0;
  var childCount = 0;
  var enterCount = 0;
  var scheduled = false;
  var closed = false;

  function invoke(fn, this_, args) {
    try {
      fn.apply(this_ || self, args || []);
    } catch (e) {
      debug('caught error: ', e, e.stack);
      self.throw(e);
    }
  }

  function flush() {
    assert(enterCount === 1);

    do {
      // Flush the callback queue.
      while (cb = callbackQueue.shift()) {
        invoke.apply(self, cb);
      }

      if (refCount === 0 && !result && !error)
        result = [];

      if (!error && !result)
        break;

      // TODO: better
      var didSignalAny = false;
      for (var id in children) {
        if (!(id in sentSignals)) {
          var child = children[id];
          sentSignals[id] = error;
          didSignalAny = true;
          child.signal(error);
        }
      }
      if (!didSignalAny)
        break;
    } while (callbackQueue.length > 0 ||
             (!error && !result) ||
             childCount > 0);

    if (childCount === 0 &&
        (error || result) &&
        !isRoot) {
      closed = true;
      parent.schedule(finalize);
    }

    scheduled = false;
  }

  function call(function_, this_, arguments_) {
    if (closed)
      throw new Error('This domain is closed');

    enterCount++;

    var previousZone = zone;
    zone = self;

    invoke(function_, this_, arguments_);

    if (enterCount === 1)
      flush();

    zone = previousZone;

    enterCount--;
  }

  function enter() {
     assert(!closed);
     assert(scheduled);
     assert(enterCount === 0);

     enterCount++;
     scheduled = false;

     var previousZone = zone;
     zone = self;

     flush();

     zone = previousZone;

     enterCount--;
  }

  function schedule(function_, this_, arguments_) {
    if (closed)
      throw new Error('This domain is closed');

    if (function_)
      callbackQueue.push([function_, this_, arguments_]);

    if (!scheduled && enterCount === 0) {
      scheduled = true;
      nextTick(enter);
    }
  }

  function finalize() {
    assert.equal(enterCount, 0);
    assert(!scheduled);

    assert(closed === true);

    assert(childCount === 0);
    assert(refCount === 0);

    assert(error || result);

    if (!isRoot)
      parent._unregister(self.id);

    Zone._onFinish && Zone._onFinish(self);

    // This logic runs in the context of the parent zone. If an error is thrown, the parent
    // catches it and forwards it to the signaling zone.
    if (callback) {
      return callback.apply(parent, [error].concat(result || []));
    } else if (error) {
      throw error;
    }
  }

  if (!isRoot)
    self.root = zone.root;
  else
    self.root = self;

  self.return = function() {
    if (error)
      return;
    else if (result)
      return void self.throw(new Error('Zone result already set.'));

    result = Array.prototype.slice.call(arguments);
    self.schedule();
  };

  self.throw = function(error_) {
    // XXX(sam) There is something to be said for an 'error' event... This means the
    // first error is returned, but no subsequent. If the zone is waiting for a
    // resource to finalize, but it can't because of an error, which is made more
    // likely because something is already wrong, then it will stall indefinitely,
    // without feedback. Not sure what solution is, but I think an alternative to
    // silence, even if just in debug mode, needs to be found.
    if (error)
      return;

    result = undefined;
    error = error_;

    self.schedule();
  };

  self.callback = function(error_) {
    if (error_)
      return self.throw(error_);
    return self.return.apply(
      null, Array.prototype.slice.call(arguments, 1));
  };

  self.signal = function(error) {
    self.onsignal(error);
  };

  self.onsignal = function(error) {
    //console.log('signaling %s', self.name);
  };

  self._register = function(id, child, ref) {
    if (id == null)
      id = uid();

    if (ref == null)
      ref = true;

    if (id in children)
      throw new Error("Can't register zone child: already registered");

    childCount++;
    children[id] = child;

    if (ref) {
      refCount++;
      refs[id] = 1;
    }

    return id;
  };

  self._unregister = function(id) {
    if (!(id in children))
      throw new Error("Can't unregister child: not registered");

    childCount--;
    delete children[id];

    if (id in refs) {
      refCount--;
      delete refs[id];
    }
  };

  self._ref = function(id) {
    if (!(id in children))
      throw new Error("Can't ref child: not registered");

    if (id in refs)
      return;

    refCount++;
    refs[id] = 1;
  };

  self._unref = function(id) {
    if (!(id in children))
      throw new Error("Can't unref child: not registered");

    if (!(id in refs))
      return;

    refCount--;
    delete refs[id];
  };

  self.setCallback = function(callback_) {
    if (callback)
      throw new Error('Callback already set');

    callback = callback_;
    callback.zone = self;
  };

  self.parentOf = function(that) {
    if (that === self)
      return false;

    for (; that; that = that.parent)
      if (self === that)
        return true;

    return false;
  };

  self.childOf = function(that) {
    return that.parentOf(self);
  };

  // Set up public properties.
  self.id = id;
  self.parent = parent;

  if (!isRoot)
    self.name = options.name;
  else
    self.name = 'Root';

  self.call = call;
  self.schedule = schedule;

  // Reference the parent.
  // TODO: specialize for root.
  if (parent)
    parent._register(id, this, true);

  if (!isRoot) {
    Zone._onStart && Zone._onStart(self);
    self.call(body, self);
  }
}

Zone.prototype.Zone = Zone;
Zone.prototype.Gate = Gate;


// Constructor for the root zone.
function RootZone() {
  isConstructingRootZone = true;
  Zone.call(this);
  isConstructingRootZone = false;
}

RootZone.prototype = Zone.prototype;
