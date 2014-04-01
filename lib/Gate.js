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
    target._register(id, self);
    target._ref(source, false);

    self.signal = function(error) {
      //self.close();
    };
  } else {
    throw new Error('target zone is not a child of the source zone');
  }

  self.call = function(function_, this_, arguments_) {
    if (zone !== source &&
        !zone.childOf(source))
      // TODO improve error message
      throw new Error('This gate cannot be used from this zone');

    target.call(function_, this_, arguments_);
  };

  self.schedule = function(function_, this_, arguments_) {
    if (zone !== source && !zone.childOf(source)) {
      // TODO improve error message
      throw new Error('This gate cannot be used from this zone');
    }

    var fn = function_;

    debug('gate %s schedule %s in %s',
      self.name, fn && (fn._zoneName || fn.name), target.name);

    target.schedule(function_, this_, arguments_);
  };

  self.close = function() {
    debug('gate %s closing', self.name);

    Gate._onClose && Gate._onClose(self);

    if (target === source)
      return;

    target._unregister(id, self);
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
    source.call(fn, this);
  else
    zone.root.call(fn, this);
}


Gate.prototype.signal = function() {
};
