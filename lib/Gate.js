'use strict';

module.exports = Gate;


var assert = require('assert');
var debug = require('./debuglog')('zone');
var uid = require('./uid.js');
var util = require('util');


function createBoundGateConstructor(fn, source) {
  return function() {
    var args = arguments;

    // Use an expression to avoid wrappedFn having a name
    var wrappedFn = function() {
      return fn.apply(this, args);
    };
    wrappedFn._zoneName = fn.name;

    return new Gate(wrappedFn, source);
  };
}


function Gate(fn, source) {
  if (!(this instanceof Gate))
    return createBoundGateConstructor(fn, source);

  var self = this;
  var id = uid();

  source = source || zone.root;
  var target = zone;

  assert(source instanceof zone.Zone);
  assert(target instanceof zone.Zone);

  self.name = fn._zoneName || fn.name || 'Anonymous';

  if (target === source) {

  } else if (target.childOf(source)) {
    target.__register__(self);
    target._ref(source, false);

  } else {
    throw new Error('target zone is not a child of the source zone');
  }

  self.run = function(fn) {
    self.apply(target, fn, Array.prototype.slice.call(arguments, 1));
  };

  self.call = function(receiver, fn) {
    self.apply(receiver, fn, Array.prototype.slice.call(argumenrs, 2));
  };

  self.apply = function(receiver, fn, args) {
    accessCheck();
    target.apply(receiver, fn, args);
  };

  self.runAsync = function(fn) {
    self.applyAsync(target, fn, Array.prototype.slice.call(arguments, 1));
  };

  self.callAsync = function(receiver, fn) {
    self.applyAsync(receiver, fn, Array.prototype.slice.call(argumenrs, 2));
  };

  self.applyAsync = function(receiver, fn, args) {
    accessCheck();
    target.applyAsync(receiver, fn, args);
  };

  self.schedule = self.runAsync;

  function accessCheck() {
    if (zone !== source &&
        !zone.childOf(source))
      // TODO improve error message
      throw new Error('This gate cannot be used from this zone');
  }

  self.close = function() {
    debug('gate %s closing', self.name);

    Gate._onClose && Gate._onClose(self);

    if (target === source)
      return;

    target.__unregister__(self);
    target._ref(false, source);
  };

  self._dump = function(options) {
    var indent = options.indent || 0;
    var prefix = (new Array(indent + 1)).join('  ');

    var result = util.format('%s+%s #%d\n',
                             prefix,
                             self.name,
                             self.id);

    if (source !== zone.root) {
      result += util.format('%s  \u25b2%s#%d\n',
                            prefix,
                            source.name,
                            source.id);
    }

    return result;
  };

  self.id = id;

  Gate._onOpen && Gate._onOpen(self);

  if (source)
    source.call(this, fn);
  else
    zone.root.call(this, fn);
}


Gate.prototype.signal = function() {
};
