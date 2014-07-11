var Zone = require('../lib/Setup.js').enable();

exports.testBeforeTask = function(test) {
  test.expect(2);
  var beforeHook = function() { test.ok(true, 'expecting a call'); };

  zone.create(function() { test.ok(test, 'running the main function'); },
              {beforeTask: beforeHook});
  test.done();
};

exports.testBeforeTaskWithError = function(test) {
  test.expect(3);
  var beforeHook = function() {
    test.equal(zone.name, 'ChildZone');
    test.ok(true, 'expecting a call');
    throw new Error('expected error');
  };

  //success called even tough code in main function did not run
  //and before hook threw error
  var successCallback = function(err) {
    test.strictEqual(zone, zone.root);
    test.done();
  };

  var childZone = zone.create(function ChildZone() {
    //never gets run
    
    test.equal(global.zone.name, 'ChildZone');
    test.ok(test, 'running the main function');
  }, {beforeTask: beforeHook, successCallback: successCallback});
};

exports.testAfterTask = function(test) {
  test.expect(2);
  var afterHook = function() { test.ok(true, 'expecting a call'); };

  zone.create(function() { test.ok(test, 'running the main function'); },
              {afterTask: afterHook});
  test.done();
};
