'use strict';

module.exports = Gate;


var assert = require('assert');
var debug = require('debuglog')('zone');
var uid = require('./uid.js');
var util = require('util');


function createBoundGateConstructor(fn, dependency) {
  return function() {
    var args = arguments;

    // Use an expression to avoid wrappedFn having a name
    var wrappedFn = function() {
      return fn.apply(this, args);
    };
    wrappedFn._zoneName = fn.name;

    return new Gate(wrappedFn, dependency);
  };
}


function Gate(fn, dependency) {
  if (!(this instanceof Gate))
    return createBoundGateConstructor(fn, dependency);

  var self = this;
  var id = uid();

  dependency = dependency || zone.root;
  var dependant = zone;

  self.name = fn._zoneName || fn.name || 'Anonymous gate';

  debug('creating gate %s from %s to %s',
    self.name, dependency.name, dependant.name);

  if (dependant === dependency) {
    // A gate between a zone and itself is a no-op.
    self.signal = function(error) {
      // Ignore
    };

  } else if (dependant.childOf(dependency)) {
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
  } else {
    throw new Error('Dependant zone is not a child of the dependency zone');
  }

  self.call = function(function_, this_, arguments_) {
    if (!zone)
      zone = root;
    if (zone !== dependency &&
        !zone.childOf(dependency))
      // TODO improve error message
      throw new Error('This gate cannot be used from this zone');

    dependant.call(function_, this_, arguments_);
  };

  self.schedule = function(function_, this_, arguments_) {
    if (!zone)
      zone = root;
    if (zone !== dependency &&
        !zone.childOf(dependency)) {
      // TODO improve error message
      throw new Error('This gate cannot be used from this zone');
    }

    debug('gate %s schedule %s in %s',
      self.name, function_._zoneName || function_.name, dependant.name);
    dependant.schedule(function_, this_, arguments_);
  };

  self.close = function() {
    debug('gate %s closing', self.name);

    Gate._onClose && Gate._onClose(self);

    if (dependant === dependency)
      return;

    dependency._unregister(id);
    dependant._unregister(id);
  };

  self._dump = function(options) {
    var indent = options.indent || 0;
    var ref = options.ref;
    var prefix = (new Array(indent + 1)).join('  ');

    var result = util.format('%s%s%s #%d\n',
                             prefix,
                             ref ? '+' : '-',
                             self.name,
                             self.id);

    if (dependency !== zone.root) {
      result += util.format('%s => %s#%d\n',
                            prefix,
                            dependency.name,
                            dependency.id);
    }

    return result;
  };

  self.id = id;

  Gate._onOpen && Gate._onOpen(self);

  dependency.call(fn, this);
}
