// TODO:
//   * The process object is an EventEmitter. Make it hebave properly in the
//     context of zones.
//   * `process.on('SIGxxx', cb)` implicitly constructs a signal watcher -
//      decide what to do with that (add to the root zone and unref?)
//   * Investigate what the zone implications are for
//     - cluster messaging: `process.on('message')`

var assert = require('assert');
var Gate = zone.Gate;


// process.nextTick
var realNextTick = process.nextTick;

process.nextTick = Gate(function nextTick(cb) {
  var gate = this;
  realNextTick(function() {
    gate.call(cb);
    gate.close();
  });
});


// process.stdin/stdout/stderr
var realStdinGetter = Object.getOwnPropertyDescriptor(process, 'stdin').get;
var realStdoutGetter = Object.getOwnPropertyDescriptor(process, 'stdout').get;
var realStderrGetter = Object.getOwnPropertyDescriptor(process, 'stderr').get;

assert.strictEqual(typeof realStdinGetter, 'function');
assert.strictEqual(typeof realStdoutGetter, 'function');
assert.strictEqual(typeof realStderrGetter, 'function');

var stdinGetter = bindToRootZone(realStdinGetter);
var stdoutGetter = bindToRootZone(realStdoutGetter);
var stderrGetter = bindToRootZone(realStderrGetter);

Object.defineProperties(process, {
  stdin: { get: stdinGetter, configurable: true },
  stdout: { get: stdoutGetter, configurable: true },
  stderr: { get: stderrGetter, configurable: true }
});

// TODO: make this a method of Zone?
function bindToRootZone(fn) {
  return function() {
    var previousZone = zone;
    zone = zone.root;
    try {
      return fn.apply(this, arguments);
    } finally {
      zone = previousZone;
    }
  }
}
