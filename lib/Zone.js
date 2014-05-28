exports.RootZone = RootZone;
exports.Zone = Zone;


var assert = require('assert');
var Gate = require('./Gate.js');
var NonError = require('./NonError.js');
var scheduler = require('./scheduler.js');
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
 *   the arguments of the wrap function.
 */
function Zone(body, options, callback) {
  assert(typeof body === 'function' || isConstructingRootZone);

  if (callback === undefined && typeof options === 'function') {
     callback = options;
     options = undefined;
  }

  if (callback != null && typeof callback !== 'function')
    throw new TypeError('callback is not a function');

  var errorFirstCallback = callback || null;
  var successCallback = null;
  var errorCallback = null;

  var name;
  if (isConstructingRootZone)
    name = 'Root';
  else if (options && options.name)
    name = options.name;
  else if (body && body.name)
    name = body.name;
  else
    name = 'Anonymous';

  // Detect call with or without new, so we can decide whether to return a
  // wrapped constructor. Simple instanceof checks don't work, because we want
  // to detect when Zone is called as a method of a zone:
  //    zone.Zone(...)
  // which fools the instance check, because the receiver is an instance of
  // Zone, but not a new zone. For new zones, its an instanceof Zone AND it does
  // not yet have it's own 'id' property.
  if (!(this instanceof Zone) || this.hasOwnProperty('id')) {
    options = util._extend({ name: name }, options);
    return createBoundZoneConstructor(body, options, callback);
  }

  var id = uid();
  var self = this;
  var isRoot = isConstructingRootZone;

  if (isRoot)
    var parent = null;
  else {
    assert(zone);
    var parent = zone;
  }

  var result = undefined;
  var error = null;

  // The last element in a linked list of children. It's value equals null if
  // the zone has no children at all.
  self.__child_list_tail__ = null;

  // The last child that ever got signaled with the current result state.
  self.__last_signaled_child__ = null;

  // Scheduled [fn, this, arguments] tuples, will can be applied to invoke()
  var callbackQueue = [];

  // Used by gates and sockets to keep parent alive. Its a 'total' that includes
  // the children's references.
  var refCount = 0;
  // The number of children of this zone.
  var childCount = 0;
  // Set to prevent flush() being re-entered by schedule()
  var scheduled = false;
  // Set after the zone has been requested to exit.
  var exiting = false;
  // Set after finalize is scheduled
  var closed = false;

  function enqueueFinalize() {
    assert(!scheduled);
    scheduled = true;
    scheduler.enqueueZone(self);
  }

  function dequeueFinalize() {
    assert(scheduled);
    scheduled = false;
    scheduler.dequeueZone(self);
  }

  self.__finalize__ = function() {
    scheduled = false;
    assert(!closed);

    if (!self.__child_list_tail__) {
      assert(refCount === 0);

      closed = true;

      if (!isRoot) {
        if (errorFirstCallback) {
          scheduler.enqueueCallback(self.parent,
                                    self.parent,
                                    errorFirstCallback,
                                    [error].concat(result || []));

        } else if (!error && successCallback) {
          scheduler.enqueueCallback(self.parent,
                                    self.parent,
                                    successCallback,
                                    result || []);

        } else if (error && errorCallback) {
          scheduler.enqueueCallback(self.parent,
                                    self.parent,
                                    errorCallback,
                                    [error]);

        } else if (error) {
          self.parent.throw(error);
        }

        self.parent.__unregister__(self);

      } else if (error) /* root */ {
        console.error(error.zoneStack);
        process.exit(1);
      }

    } else if (self.__last_signaled_child__ !== self.__child_list_tail__) {
      assert(refCount === 0 || exiting);
      self.__last_signaled_child__ = self.__child_list_tail__;

      var previousZone = zone;
      zone = self;

      try {
        self.__last_signaled_child__.signal(error);
      } finally {
        zone = previousZone;
      }
    }
  };

  if (!isRoot)
    self.root = zone.root;
  else
    self.root = self;

  self.return = function() {
    if (error)
      return;
    else if (result !== undefined)
      return void self.throw(new Error('Zone result already set.'));

    result = Array.prototype.slice.call(arguments);
    exiting = true;

    if (!scheduled)
      enqueueFinalize();
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

    if (!(error_ instanceof Error))
      error_ = new NonError(error_);

    if (!error_.zone) {
      Object.defineProperty(error_,
                            'zone',
                            { value: zone, enumerable: false });
    }

    result = undefined;
    error = error_;
    exiting = true;

    // If the last signaled child was signaled for the reason of the zone
    // being empty, we now need to re-signal it with an error reason.
    self.__last_signaled_child__ = null;

    if (!scheduled)
      enqueueFinalize();
  };

  self.complete = function(error_) {
    if (error_ != null)
      return self.throw(error_);
    else
      return self.return.apply(self, Array.prototype.slice.call(arguments, 1));
  };

  self.signal = function(error_) {

    if (error_) {
      if (error)
        return;

      error = error_;
      result = undefined;
      exiting = true;

      // If the last signaled child was signaled for the reason of the zone
      // being empty, we now need to re-signal it with an error reason.
      self.__last_signaled_child__ = null;

    } else /* graceful */ {
      if (exiting)
        return;

      exiting = true;
    }

    if (!scheduled)
      enqueueFinalize();
  };

  self.__register__ = function(child, top) {
    assert((child && typeof child === 'object') ||
           typeof child === 'function');
    assert(child.__prev__ === undefined);
    assert(child.__next__ === undefined);
    assert(typeof child.signal === 'function');
    assert(!top || top === true);

    // TODO: use LinkedList infrastructure for this.
    if (!top || self.__child_list_tail__ === null) {
      child.__prev__ = self.__child_list_tail__;
      child.__next__ = null;

      if (self.__child_list_tail__ !== null)
        self.__child_list_tail__.__next__ = child;

      self.__child_list_tail__ = child;

    } else if (self.__child_list_tail__ !== null) {
        // Expensive!
        var head = self.__child_list_tail__;
        while (head.__prev__)
          head = head.__prev__;

        child.__prev__ = null;
        child.__next__ = head;
        head.__prev__ = child;
    }

    childCount++;

    if (!scheduled && (refCount === 0 || exiting))
      enqueueFinalize();
  };

  self.__unregister__ = function(child) {
    assert((child && typeof child === 'object') ||
           typeof child === 'function');
    assert(child.__prev__ !== undefined);
    assert(child.__next__ !== undefined);

    if (self.__child_list_tail__ === child)
      self.__child_list_tail__ = child.__next__ || child.__prev__;

    if (child.__prev__ !== null)
      child.__prev__.__next__ = child.__next__;
    if (child.__next__ !== null)
      child.__next__.__prev__ = child.__prev__;

    child.__prev__ = undefined;
    child.__next__ = undefined;

    childCount--;

    if (!scheduled && (refCount === 0 || exiting))
      enqueueFinalize();
  };

  self._ref = function(ref, unref) {
    assert(!ref || ref instanceof Zone);
    assert(!unref || unref instanceof Zone);

    if (self === ref)
      ref = false;

    if (self === unref)
      unref = false;

    if (!ref && !unref)
      return;

    if (ref && !unref) {
      refCount++;

      if (!exiting && scheduled)
        dequeueFinalize();

    } else if (unref && !ref) {
      refCount--;

      if (refCount === 0 && !scheduled)
        enqueueFinalize();
    }

    if (parent)
      parent._ref(ref, unref);
  };

  self._dump = function(options) {
    var indent = options.indent || 0;
    var prefix = (new Array(indent + 1)).join('  ');

    var ownDesc = util.format('%s+%s #%d [%d children, %d refs]\n',
                              prefix,
                              self.name,
                              self.id,
                              childCount,
                              refCount);

    // Walk the children in reverse order.
    var childDesc = '';
    for (var child = self.__child_list_tail__; child; child = child.__prev__) {
      childDesc = child._dump({ indent: indent + 1 }) + childDesc;
    }

    return ownDesc + childDesc;
  };

  self.setCallback = function(errorFirstCallback_) {
    if (errorFirstCallback_ != null) {
      if (typeof errorFirstCallback_ !== 'function')
        throw new TypeError('callback is not a function');

      if (errorFirstCallback || successCallback || errorCallback)
        throw new Error('Callback already set');

      errorFirstCallback = errorFirstCallback_;
    }

    return self;
  };

  self.then = function(successCallback_, errorCallback_) {
    if (successCallback_ != null) {
      if (typeof successCallback_ !== 'function')
        throw new TypeError('callback is not a function');

      if (errorFirstCallback || successCallback)
        throw new Error('Callback already set');

      successCallback = successCallback_;
    }

    if (errorCallback_ != null) {
      if (typeof errorCallback_ !== 'function')
        throw new TypeError('callback is not a function');

      if (errorFirstCallback || errorCallback)
        throw new Error('Callback already set');

      errorCallback = errorCallback_;
    }

    return self;
  };

  self.catch = function(errorCallback_) {
    if (errorCallback_ != null) {
      if (typeof errorCallback_ !== 'function')
        throw new TypeError('callback is not a function');

      if (errorFirstCallback || errorCallback)
        throw new Error('Callback already set');

      errorCallback = errorCallback_;
    }

    return self;
  };

  self.parentOf = function(that) {
    assert(that instanceof Zone);

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

  self.run = function(fn) {
    self.apply(self, fn, Array.prototype.slice.call(arguments, 1));
  };

  self.call = function(receiver, fn) {
    self.apply(receiver, fn, Array.prototype.slice.call(arguments, 2));
  };

  self.apply = function(receiver, fn, args) {
    var previousZone = zone;
    global.zone = this;

    try {
      var result = fn.apply(receiver, args);
    } catch (err) {
      //process._rawDebug(err.stack);
      self.throw(err);
    }

    if (result !== undefined)
      process._rawDebug('Garbage returned from callback ' + fn.name + ': ' + result);

    global.zone = previousZone;
  };

  self.runUnsafe = function(fn) {
    return self.applyUnsafe(self, fn, Array.prototype.slice.apply(arguments, 1));
  };

  self.callUnsafe = function(receiver, fn) {
    return self.applyUnsafe(receiver, fn, Array.prototype.slice.call(arguments, 2));
  };

  self.applyUnsafe = function(receiver, fn, args) {
    var previousZone = zone;
    global.zone = this;

    try {
      return fn.apply(receiver, args);
    } finally {
      global.zone = previousZone;
    }
  };


  self.runAsync = function(fn) {
    self.applyAsync(self, fn, Array.prototype.slice.apply(arguments, 1));
  };

  self.callAsync = function(receiver, fn) {
    self.applyAsync(receiver, fn, Array.prototype.slice.call(arguments, 2));
  };

  self.applyAsync = function(receiver, fn, args) {
    scheduler.enqueueCallback(self, receiver, fn, args);
  };

  //self.schedule = self.runAsync;

  // Set up public properties.
  self.id = id;
  self.parent = parent;
  self.name = name;

  // Zone.data can be used by the user to store arbitrary data. For the root
  // zone, the data property equals the global object. In other zones, the
  // data property is an empty object which has the .data property of the
  // parent zone as its prototype.
  if (isRoot)
    self.data = global;
  else
    self.data = Object.create(parent.data);

  // Reference the parent.
  if (!isRoot) {
    parent.__register__(self);

    Zone._onStart && Zone._onStart(self);

    self.run(body);

    if (refCount === 0 && !scheduled)
      enqueueFinalize();
  }

  // Capture the zone construction stack. Do this last, so the zone has the
  // chance to modify it's own name and it'll show up in the stack trace.
  // TODO: limit the stack trace depth?
  Error.captureStackTrace(this, Zone);
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
