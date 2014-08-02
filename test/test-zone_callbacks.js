var Zone = require('../lib/setup.js').enable();

var assert = require('assert');
var Zone = zone.Zone;

// Test primary callback with result.
exports.testErrbackWithResult = function(test) {
  var zoneFunc = function() { zone.return(42); };
  var cb = function(err, a, b) {
    test.strictEqual(err, null);
    test.strictEqual(a, 42);
    test.strictEqual(b, undefined);
    test.done();
  };
  zone.create(zoneFunc).setCallback(cb);
};

// Test primary callback with error.
exports.testErrbackWithError = function(test) {
  var zoneFunc = function() {
    zone.return(42);
    throw new Error();
  };

  var cb = function(err, a, b) {
    test.ok(err instanceof Error);
    test.equal(a, undefined);
    test.equal(b, undefined);
    test.done();
  };
  zone.create(zoneFunc).setCallback(cb);
};

// Test catch callback.
exports.testCatchBlock = function(test) {
  var zoneFunc = function() { zone.throw(new Error()); };
  var cb = function(err) {
    test.ok(err instanceof Error);
    test.done();
  };
  zone.create(zoneFunc).catch (cb);
};

exports.testThenWithError = function(test) {
  var zoneFunc = function() { throw new Error(); };
  var successCb = function onSuccess() { test.ok('false'); };
  var errorCb = function onError(err) {
    test.ok(err instanceof Error);
    test.done();
  };
  zone.create(zoneFunc).then(successCb, errorCb);
};

exports.testThenWithSuccess = function(test) {
  var zoneFunc = function() { this.return(1, 2, 3); };
  var successCb = function onSuccess(a, b, c) {
    test.strictEqual(a, 1);
    test.strictEqual(b, 2);
    test.strictEqual(c, 3);
    test.done();
  };
  var errorCb = function onError(err) { test.ok(false); };
  zone.create(zoneFunc).then(successCb, errorCb);
};

exports.testCompleteMethod = function(test) {
  var zoneFunc = function() { zone.complete(null, 42); };
  var cb = function(err, value) {
    test.strictEqual(value, 42);
    test.done();
  };
  zone.create(zoneFunc).setCallback(cb);
};

exports.testThrowingNonError = function(test) {
  var zoneFunc = function() { throw 133; };
  var cb = function(err) {
    test.ok(err instanceof Error);
    test.strictEqual(err.value, 133);
    test.done();
  };
  zone.create(zoneFunc).catch (cb);
};

exports.testAutoExit = function(test) {
  var zoneFunc = function() {  // no-op
  };
  var cb = function(err) {
    test.strictEqual(err, null);
    test.strictEqual(arguments.length, 1);
    test.done();
  };
  zone.create(zoneFunc).setCallback(cb);
};
