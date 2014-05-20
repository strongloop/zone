
var assert = require('assert');
var Zone = zone.Zone;

var exports = zone.Zone.prototype;

function noop() {}

function inspectCallback(options) {
  var indent = options.indent || 0;
  var prefix = (new Array(indent + 1)).join('  ');

  var result = util.format('%s+%s\n',
                           prefix,
                           this.name);

  if (this.__zone__ !== zone.root) {
    result += util.format('%s  \u25b2%s#%d\n',
                          prefix,
                          this.sourceZone.name,
                          this.sourceZone.id);
  }

  return result;
}

function clearCallback() {
  var targetZone = this.targetZone;
  var sourceZone = this.sourceZone;
  var active = this.active;

  if (!active)
    return;

  targetZone.__unregister__(this);
  targetZone._ref(false, sourceZone);
  this.active = false;
}

function bindCallbackInternal(fn, once, sourceZone, targetZone, signal) {
  var active = true;

  targetZone = targetZone || zone;

  assert(sourceZone === targetZone ||
         sourceZone.parentOf(targetZone));

  var wrappedFn = function() {
    if (once)
      wrappedFn.clear();
    targetZone.applyAsync(this, fn, arguments);
  };

  wrappedFn.name = fn.name;
  wrappedFn.active = true;
  wrappedFn.sourceZone = sourceZone;
  wrappedFn.targetZone = targetZone;
  wrappedFn.signal = signal || noop;
  wrappedFn.clear = clearCallback;
  wrappedFn._dump = inspectCallback;

  targetZone._ref(sourceZone, false);
  targetZone.__register__(wrappedFn);

  return wrappedFn;
}

function signalEventSource(err) {
  if (err)
    zone.throw(err);
}

function initEventSource(obj, sourceZone) {
  if (obj.__zone__ instanceof Zone)
    return;
  
  obj.__zone__ = sourceZone;
  
  if (typeof obj.signal !== 'function')
    obj.signal = signalEventSource;
    
  obj.__zone__.__register__(obj);
}

function destroyEventSource(obj) {
  obj.__zone__.__unregister__(obj);
  delete obj.__zone__;
}

function bindConstructor(fn, options) {
  if (typeof fn !== 'function')
    throw new TypeError('First argument should be a function');

  if (fn.__bound__)
    throw new Error('Function has already been bound');

  if (options == null)
    options = {};
  else if (typeof options !== 'object')
    throw new TypeError('Second argument should be an object');

  var sourceZone = null;

  if (options.zone == null) {
    // Do nothing.
  } else if (options.zone instanceof Zone) {
    sourceZone = options.zone;
  } else {
    throw new TypeError('`zone` option is not a zone, ' +
                        'or the `owner` is not an EventSource');
  }

  var wrappedConstructor = function() {
    var self = Object.create(fn.prototype);
    
    if (!sourceZone)
      sourceZone = zone;
      
    initEventSource(self, sourceZone);

    var previousZone = zone;
    zone = sourceZone;

    try {
      var result = fn.apply(self, arguments);

      console.log(self.__zone__);
      
      if (result == null ||
          typeof result === 'number' ||
          typeof result === 'boolean' ||
          typeof result === 'string')
        result = self;

      return result;
      
    } catch (err) {
      destroyEventSource(self);
      zone.throw(err);
      throw err;

    } finally {
      zone = previousZone;
    }
  };

  for (var key in fn) {
    wrappedConstructor[key] = fn[key];
  }

  wrappedConstructor.prototype = fn.prototype;
  wrappedConstructor.prototype.constructor = wrappedConstructor;

  return wrappedConstructor;
}


function bind(fn, options, asMethod) {
  if (typeof fn !== 'function')
    throw new TypeError('First argument should be a function');

  if (fn.__bound__)
    throw new Error('Function has already been bound');

  if (options == null) {
    options = {};
  } else if (typeof options !== 'object') {
    throw new TypeError('Second argument should be an object');
  }

  var sourceZone = null;

  if (options.zone instanceof Zone) {
    sourceZone = options.zone;
    asMethod = false;
  
  } else if (options.zone != null) {
    throw new TypeError('`zone` option is not a zone');
    
  } else if (!asMethod) {
    sourceZone = zone;
  }

  var once = false;
  var multiple = false;
  var hasCallback = true;
  var callbackType = options.type;

  if (options.type == null) {
    callbackType = 'once';
    once = true;
  } else if (options.type === 'once') {
    once = true;
  } else if (options.type === 'multiple')
    multiple = true;
  else if (options.type === 'none')
    hasCallback = false;
  else
    throw new TypeError('Callback `type` option not supported');

  var required = false;

  if (options.required == null || options.required === false) {
    // optional is the default
  } else if (options.required === true && hasCallback) {
    required = options.required;
  } else if (options.required === true) {
    throw new TypeError('`required` option is incompatibe with the lack of a callback');
  } else {
    throw new TypeError('`required` option should be a boolean');
  }

  var offset = 0;
  var lengthFactor = 0;

  if (options.position == null) {
    offset = -1;
    lengthFactor = 1;
  } else if (~~options.position < 0) {
    offset = options.position;
    lengthFactor = 1;
  } else if (options.position === ~~options.position) {
    offset = options.position;
  } else {
    throw new TypeError('`position` option is not an integer');
  }

  var boundFunction = function() {
    if (sourceZone) {
      // Do nothing.
    } else if(this.__zone__ instanceof Zone) {
      sourceZone = this.__zone__;
    } else {
      throw new TypeError('`this` (receiver) object is not bound to a zone');      
    }
    
    var callback = null;
    var callbackPosition = arguments.length * lengthFactor + offset;
    
    if (hasCallback && arguments.length > 0)
      callback = arguments[callbackPosition];

    if (typeof callback === 'function') {
      callback = arguments[callbackPosition] = bindCallbackInternal(callback, once, sourceZone);
    } else if (required) {
      throw new TypeError('No callback given');
    } else {
      callback = null;
    }

    var previousZone = zone;
    zone = sourceZone;

    try {
      return fn.apply(this, arguments);

    } catch (err) {
      if (callback)
        callback.clear();
        
      zone.throw(err);
      throw err;

    } finally {
      zone = previousZone;
    }
  };

  boundFunction.__bound__ = true;

  return boundFunction;
}

function bindFunction(fn, options) {
  return bind(fn, options, false);
}

function bindMethod(fn, options) {
  return bind(fn, options, true);
}

function bindMany(obj, names, options, method) {
  if (typeof names === 'string') {
    obj[names] = method(obj[names], options);

  } else if (names == null) {
    for (var key in obj) {
      var fn = obj[key];
      if (typeof fn !== 'function')
        continue;
      if (fn.__bound__)
        continue;
      obj[key] = method(fn, options);
    }

  } else {
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var fn = obj[name];
      if (typeof fn !== 'function')
        continue;
      if (fn.__bound__)
        continue;
      obj[name] = method(fn, options);
    }
  }
}

function except(fn) {
  fn.__bound__ = true;
  return fn;
}

exports.bindFunction = bindFunction;
exports.bindMethod = bindMethod;
exports.bindConstructor = bindConstructor;
exports.except = except;

exports.bindFunctions = function(obj, names, options) {
  bindMany(obj, names, options, bindFunction);
};

exports.bindMethods = function(obj, names, options) {
  bindMany(obj, names, options, bindMethod);
};

exports.bindConstructors = function(obj, names, options) {
  bindMany(obj, names, options, bindConstructor);
};


