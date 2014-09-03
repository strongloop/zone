var Zone = require('../lib/setup.js').enable();

exports.emitterInRootZone = function(test) {
  var EventEmitter = require('events').EventEmitter;
  var emitter = new EventEmitter();

  test.expect(2);
  setTimeout(function() {
    test.ok(true);
    emitter.emit('myevent', 'FOO');
  }, 10);

  emitter.on('myevent', function(ray) {
    test.equal(ray, 'FOO');
    test.done();
  });
};

exports.emitterCrossZone1 = function(test) {
  var EventEmitter = require('events').EventEmitter;
  var emitter = new EventEmitter();
  test.expect(2);

  var ChildZone = function ChildZone(test, emitter) {
    setTimeout(function() {
      test.ok(true);
      emitter.emit('myevent', 'FOO');
    }, 10);

    emitter.once('myevent', function(ray) { test.equal(ray, 'FOO'); });
  };

  var doneCB = function() { test.done(); };

  c = zone.define(ChildZone, {successCallback: doneCB});
  c(test, emitter);
};

exports.emitterCrossZone2 = function(test) {
  var EventEmitter = require('events').EventEmitter;
  var emitter = new EventEmitter();
  test.expect(2);

  var ChildZone = function ChildZone(test, emitter) {
    emitter.once('myevent', function(ray) { test.equal(ray, 'FOO'); });
  };

  var doneCB = function() { test.done(); };

  c = zone.define(ChildZone, {successCallback: doneCB});
  c(test, emitter);

  setTimeout(function() {
    test.ok(true);
    emitter.emit('myevent', 'FOO');
  }, 10);
};

exports.testAddRemoveListener = function(test) {
  var EventEmitter = require('events').EventEmitter;
  var emitter = new EventEmitter();
  var listener = function(data) { test.ok(true); };
  var done = function(data) { test.done(); };

  test.expect(1);
  emitter.on('myevent', listener);
  emitter.once('done', done);
  emitter.emit('myevent', 'FOO');
  emitter.removeListener('myevent', listener);
  emitter.emit('myevent', 'FOO');
  emitter.emit('done', 'done');
};

exports.testEmitOnce = function(test) {
  var EventEmitter = require('events').EventEmitter;
  var emitter = new EventEmitter();
  var listener = function(data) { test.ok(true); };
  var done = function(data) { test.done(); };

  test.expect(1);
  emitter.once('myevent', listener);
  emitter.once('done', done);
  emitter.emit('myevent', 'FOO');
  emitter.emit('myevent', 'FOO');
  emitter.emit('done', 'done');
};
