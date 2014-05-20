
require('../common.js');

var assert = require('assert');
var Zone = zone.Zone;


var MyClass = function() {
  assert(zone === zone.root);
  //throw new Error('ouch!');
}

MyClass.prototype.testMethod = function(fortytwo, cb) {
  assert(fortytwo === 42);
  assert(zone === zone.root);
  cb(null, 43);
}

MyClass = zone.bindConstructor(MyClass);
zone.bindMethods(MyClass.prototype);

var obj = new MyClass();

var myZone = new Zone(function() {
  
  obj.testMethod(42, function(err, fortythree) {
    console.log('hello!');
    assert(zone === myZone);
    assert(err === null);
    assert(fortythree === 43);
  });
});

