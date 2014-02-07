
module.exports = Gate;


var assert = require('assert');
var uid = require('./uid.js');


function createBoundGateConstructor(fn, dependency) {
  return function() {
    var args = arguments;

    function wrappedFn() {
      return fn.apply(this, args);
    }
    wrappedFn.name = fn.name;

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

  console.log('zone-debug - creating gate from %s to %s', dependency.name, dependant.name);

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
        !zone.childOf(dependency))
      // TODO improve error message
      throw new Error('This gate cannot be used from this zone');

    dependant.schedule(function_, this_, arguments_);
  };

  self.close = function() {
    if (dependant === dependency)
      return;

    dependency._unregister(id);
    dependant._unregister(id);
  };

  self.id = id;

  dependency.call(fn, this);
}
