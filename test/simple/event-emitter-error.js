

// Verify that and unhandled 'error' does not break zone cleanup.
// The timer should still be canceled and the zone should pass the emitter
// error to it's callback.

require('../common.js');

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var Zone = zone.Zone;

var callbackCount = 0;

new Zone(function() {
  setTimeout(function() {
    throw new Error('This code should never run');
  }, 1000);

  var ee = new EventEmitter();

  var error = new Error('This error is expected');
  ee.emit('error', error);

  process.nextTick(function() {
    callbackCount++;
  });

}).catch (function(err) {
  callbackCount++;
  assert(/expected/.test(err.message));
});

process.on('exit', function() {
  assert(callbackCount === 2);
});
