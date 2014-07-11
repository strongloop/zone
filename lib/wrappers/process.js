// TODO:
//   * The process object is an EventEmitter. Make it hebave properly in the
//     context of zones.
//   * `process.on('SIGxxx', cb)` implicitly constructs a signal watcher -
//      decide what to do with that (add to the root zone and unref?)
//   * Investigate what the zone implications are for
//     - cluster messaging: `process.on('message')`

var assert = require('assert');

process.nextTick = function(cb) { global.zone.scheduleMicrotask(cb); };

// process.stdin/stdout/stderr
var realStdinGetter = Object.getOwnPropertyDescriptor(process, 'stdin').get;
var realStdoutGetter = Object.getOwnPropertyDescriptor(process, 'stdout').get;
var realStderrGetter = Object.getOwnPropertyDescriptor(process, 'stderr').get;

assert(typeof realStdinGetter === 'function');
assert(typeof realStdoutGetter === 'function');
assert(typeof realStderrGetter === 'function');

var stdinGetter =
    zone.root.bindCallback(null, realStdinGetter, zone.root,
                           {autoRelease: false, name: 'stdinGetter'});
var stdoutGetter =
    zone.root.bindCallback(null, realStdoutGetter, zone.root,
                           {autoRelease: false, name: 'stdoutGetter'});
var stderrGetter =
    zone.root.bindCallback(null, realStderrGetter, zone.root,
                           {autoRelease: false, name: 'stderrGetter'});

Object.defineProperties(process, {
  stdin: {get: stdinGetter, configurable: true},
  stdout: {get: stdoutGetter, configurable: true},
  stderr: {get: stderrGetter, configurable: true}
});
