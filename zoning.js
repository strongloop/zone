
var assert = require('assert');

var nextTick = process.nextTick;
var uidCounter = 0;
var root;

global.zone = global.zone || null;

function uid() {
  return ++uidCounter;
}

function throwIfError(error) {
  if (error)
    throw error;
}
  
function createBoundZoneConstructor(body, options, callback) {
  return function() {  
    var args = arguments;
    
    function wrappedBody() {
      return body.apply(this, args);
    }
    wrappedBody.name = body.name;
    
    return new Zone(wrappedBody, options, callback);
  }
}
  
function Zone(body, options, callback) {
  if (callback === undefined && typeof options === 'function') {
     callback = options;
     options = undefined;
  }
  
  if (options === null)
    options = {};
  
  if (callback == null)
    callback = null;
  
  if (!(this instanceof Zone))
    return createBoundZoneConstructor(body, options, callback);
  
  var id = uid();
  var self = this;
  var parent = zone || null;
  
  var result = undefined;
  var error = undefined;
  
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
      //console.log('HANDLED ERROR: ', e, e.stack);
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
      var didSignalAny = false
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
        (error || result)) {
      closed = true;
      // TODO: specialize for root
      parent && parent.schedule(finalize);
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
    assert(enterCount === 0);
    assert(!scheduled);
    
    assert(closed === true);
    
    assert(childCount === 0);
    assert(refCount === 0);
    
    assert(error || result);

    // TODO: specialize for root
    if (parent)
      parent._unregister(self.id);
    
    // This logic runs in the context of the parent zone. If an error is thrown, the parent
    // catches it and forwards it to the signaling zone.
    if (callback) {
      return callback.apply(parent, [error].concat(result || []));
    } else {
      throw error;
    }
  }
   
  self.return = function() {
    if (error)
      return;
    else if (result)
      return void self.throw(new Error('Zone result already set.'));
    
    self.result = Array.prototype.slice.call(arguments);
    
    self.schedule();
  };
  
  self.throw = function(error_) {
    if (error)
      return;
      
    result = undefined;
    error = error_;
    
    self.schedule();
  }
  
  self.signal = function(error) {
    self.onsignal(error);
  }
  
  self.onsignal = function(error) {
    //console.log('signaling %s', self.name);
  }
  
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
      
    for ( ; that; that = that.parent)
      if (self === that)
        return true;
        
    return false;
  };
  
  self.childOf = function(that) {
    return that.parentOf(self);
  };
  
  // Set up public properties.
  self.id = id;
  self.name = body && body.name || 'Anonymous zone';
  self.parent = parent;
  
  self.call = call;
  self.schedule = schedule;
  
  // Reference the parent.
  // TODO: specialize for root.
  if (parent)
    parent._register(id, this, true);

  self.call(body, self);
}

function createBoundGateConstructor(dependency, body) {
  return function() {  
    var args = arguments;
    
    function wrappedBody() {
      return body.apply(this, args);
    }
    wrappedBody.name = body.name;
    
    return new Gate(dependency, wrappedBody);
  }
}


function Gate(dependency, fn) {
  if (!(this instanceof Gate))
    return createBoundGateConstructor(dependency, fn);
  
  var self = this;
  var dependant = zone;
  var id = uid();
  
  if (!dependant.childOf(dependency))
    throw new Error('Dependant zone is not a child of the dependency zone');
    
  dependency._register(id, self, false);
  dependant._register(id, self, true);
  
  self.signal = function(error) {
    if (error) {
      if (zone === dependant)
        dependency.signal(error);
      else if (zone === dependency)
        dependant.signal(error);
    }
    //self.close();
  };
  
  self.schedule = function(function_, this_, arguments_) {
    dependant.schedule(function_, this_, arguments_);
  };
  
  self.close = function() {
    dependency._unregister(id);
    dependant._unregister(id);
  };
  
  self.id = id;
  
  dependency.call(fn, this);
}

new Zone(function RootZone() {
  root = this;
  
  // Hook process.setTimeout
  var realSetTimeout = global.setTimeout;
  var realClearTimeout = global.clearTimeout;
  
  global.setTimeout = Gate(root, function(cb, timeout) {
    var gate = this;
    
    var handle = realSetTimeout(function() {
      gate.schedule(cb);
      gate.close();
      handle = null;
    }, timeout);
    
    gate.clear = function() {
      if (!handle)
        return;
      realClearTimeout(handle);
      gate.close();
      handle = null;
    };
  });
  
  global.clearTimeout = function(gate) {
    gate.clear();
  };
  
  // Hook process.setInterval
  var realSetInterval = global.setInterval;
  var realClearInterval = global.clearInterval;
  
  global.setInterval = Gate(root, function(cb, interval) {
    var gate = this;
    
    var handle = realSetInterval(function() {
      gate.schedule(cb);
    }, interval);
    
    gate.clear = function() {
      if (!handle)
        return;
      
      // Calling realClearTimeout may seem wrong here but
      // timers.js has some weirdness going on that makes this right.
      handle._repeat = false; 
      realClearTimeout(handle);
  
      gate.close();
      handle = null;
    };
  });
  
  global.clearInterval = function(gate) {
    gate.clear();
  };
  
  // Hook fs.stat
  var realStat = require('fs').stat;
  var stat = Gate(root, function(file, cb) {
    var gate = this;
    realStat(file, function(err, stats) {
      gate.schedule(function() {
        cb(err, stats); 
      });
      gate.close();
    });
  });
  
  new Zone(function outer_zone() {
    console.log('Beginning zone %s', zone.name);
    
    var n = 5;
    var iv = setInterval(function() {
      console.log('setInterval callback in zone %s. Left: %s', zone.name, n--);
      if (n === 0)
        clearInterval(iv);
    }, 500);
    
    new Zone(function inner_zone() {
      console.log('Beginning zone %s', zone.name);
      setTimeout(function() {
        console.log('setTimeout callback in zone %s', zone.name);
      }, 1000);
    }).setCallback(function(error) {
      console.log('Zone inner_zone ended, back in %s. Error: ', zone.name, error);
    });
    
    new Zone(function stat_zone() {
      stat('bla', function(error, stats) {
        console.log('stat() callback in zone %s. (error, result) = (%s, %s)', zone.name, error, stats);
        if (error) 
          throw error;
      });
    }).setCallback(function(error) {
      console.log('Zone stat_zone ended, back in %s. Error: %s', zone.name, error);
      if (error) throw error;
    });
    
  }).setCallback(function(error, result) {
    console.log('Zone outer_zone ended, back in %s. Error: %s', zone.name, error);
    if (error) throw error;
  });
});

