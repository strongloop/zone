exports.RootZone = RootZone;
exports.Zone = Zone;


var assert = require('assert');
var debug = require('./debuglog')('zone');
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
 *   the arguments of the wrap function.
 */
function Zone(body, options, callback) {
  assert(typeof body === 'function' || isConstructingRootZone);

  if (callback === undefined && typeof options === 'function') {
     callback = options;
     options = undefined;
  }

  if (callback == null)
    callback = null;
  else
    assert(typeof callback === 'function');

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

  // Used by gates and sockets to keep parent alive. Its a 'total' that includes
  // the children's references.
  var refCount = 0;
  // The number of children of this zone.
  var childCount = 0;
  // Incremented while a function is being invoked in this zone
  var enterCount = 0;
  // Set to prevent flush() being re-entered by schedule()
  var scheduled = false;
  // Set after finalize is scheduled
  var closed = false;

  // argument order suitable for having callbackQueue entries applied
  function invoke(fn, this_, args) {
    try {
      fn.apply(this_ || self, args || []);
    } catch (e) {
      debug('invoke caught error: ', e, e.stack);
      self.throw(e);
    }
  }

  function flush() {
    scheduled = true;

    assert(enterCount === 1);

    // Loop until completion, but only while there are callbacks to invoke, or
    // children to signal.
    do {
      // Flush the callback queue.
      while (cb = callbackQueue.shift()) {
        invoke.apply(self, cb);
      }

      if (refCount === 0 && !result && !error)
        result = [];

      if (!error && !result)
        break;

      if (childCount === 0) {
        assert.strictEqual(self.__child_list_tail__, null);
        break;
      }

      // Signal children that zone is ready to complete, it has an error or
      // result.
      if (self.__last_signaled_child__ === self.__child_list_tail__) {
        self.__last_signaled_child__ = self.__child_list_tail__;
        self.__last_signaled_child__.signal(error);
      }

    } while (callbackQueue.length > 0);

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
      throw new Error('zone ' + name + ' is closed');

    enterCount++;

    var previousZone = zone;
    zone = self;

    function_ && invoke(function_, this_, arguments_);

    if (enterCount === 1)
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
      // Optimization, don't queue up a tick if call() or flush() is running or
      // queued to run
      scheduled = true;
      // Call will flush when necessary
      nextTick(call);
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
      parent.__unregister__(self);

    Zone._onFinish && Zone._onFinish(self);

    // This logic runs in the context of the parent zone. If an error is thrown,
    // the parent catches it and forwards it to the signaling zone.
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

  self.signal = function(error_) {
    if (error)
      return;

    if (error_) {
      error = error_;
      self.schedule();
    }

    if (result)
      return;

    self.schedule();
  };

  self.__register__ = function(child) {
    assert(child && typeof child === 'object');
    assert(child.__prev__ === undefined);
    assert(child.__next__ === undefined);
    assert(typeof child.signal === 'function');

    child.__prev__ = self.__child_list_tail__;
    child.__next__ = null;

    if (self.__child_list_tail__ !== null)
      self.__child_list_tail__.__next__ = child;

    self.__child_list_tail__ = child;

    childCount++;
  };

  self.__unregister__ = function(child) {
    assert(child && typeof child === 'object');
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
    } else if (unref && !ref) {
      refCount--;
      if (refCount === 0) {
        schedule();
      }
    }

    if (parent)
      parent._ref(ref, unref);
  };

  self._dump = function(options) {
    var indent = options.indent || 0;
    var prefix = (new Array(indent + 1)).join('  ');

    var ownDesc = util.format('%s+%s #%d [%d children]\n',
                              prefix,
                              self.name,
                              self.id,
                              childCount);

    //return util.inspect(self);

    // Walk the children in reverse order.
    var childDesc = '';
    for (var child = self.__child_list_tail__; child; child = child.__prev__) {
      childDesc = child._dump({ indent: indent + 1 }) + childDesc;
    }

    return ownDesc + childDesc;
  };

  self.setCallback = function(callback_) {
    if (callback)
      throw new Error('Callback already set');

    callback = callback_;
    callback.zone = self;
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

  // Set up public properties.
  self.id = id;
  self.parent = parent;
  self.name = name;
  self.call = call;
  self.schedule = schedule;

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
