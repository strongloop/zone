

require('../common.js');

var assert = require('assert');
var Zone = zone.Zone;

var callbackCount = 0;

// Test error-first callback with result.
new Zone(function() {
  zone.return(42);

}).setCallback(function(err, a, b) {
  assert(err === null);
  assert(a === 42);
  assert(b === undefined);
  callbackCount++;
});

  // Test error-first callback with error.
new Zone(function() {
  zone.return(42);
  throw new Error();

}).setCallback(function(err, value) {
  assert(err instanceof Error);
  assert(value === undefined);
  callbackCount++;
});

// Test catch callback.
new Zone(function() {
  zone.throw(new Error());

}).catch (function(err) {
  assert(err instanceof Error);
  callbackCount++;
});

// Test 'then' with error callback.
new Zone(function() {
  throw new Error();

}).then(function onSuccess() {
  assert.fail();
}, function onError(err) {
  assert(err instanceof Error);
  callbackCount++;
});

// Test 'then' with success callback.
new Zone(function() {
  this.return(1, 2, 3);

}).then(function onSuccess(a, b, c) {
  assert(a === 1);
  assert(b === 2);
  assert(c === 3);
  callbackCount++;
}, function onError() {
  assert.fail();
});

// Test .complete() method.
new Zone(function() {
  zone.complete(null, 42);
}).setCallback(function(err, value) {
  assert(value === 42);
  callbackCount++;
});

// Test throwing a non-error.
new Zone(function() {
  throw 133;
}).catch (function(err) {
  assert(err instanceof Error);
  assert(err.value === 133);
  callbackCount++;
});

// Test auto-exit return value.
new Zone(function() {
  // Do nothing.
}).setCallback(function(err) {
  assert(err === null);
  assert(arguments.length === 1);
  callbackCount++;
});

process.on('exit', function() {
  assert(callbackCount === 8);
});
