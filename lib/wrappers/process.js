// TODO:
//   * The process object is an EventEmitter. Make it hebave properly in the
//     context of zones.
//   * `process.on('SIGxxx', cb)` implicitly constructs a signal watcher -
//      decide what to do with that (add to the root zone and unref?)
//   * Investigate what the zone implications are for
//     - cluster messaging: `process.on('message')`

var assert = require('assert');

process._rawDebug('process wrap');

process.nextTick = function(cb) { global.zone.scheduleMicrotask(cb); };

// process.stdin/stdout/stderr
var realStdinGetter = Object.getOwnPropertyDescriptor(process, 'stdin').get;
var realStdoutGetter = Object.getOwnPropertyDescriptor(process, 'stdout').get;
var realStderrGetter = Object.getOwnPropertyDescriptor(process, 'stderr').get;

assert(typeof realStdinGetter === 'function');
assert(typeof realStdoutGetter === 'function');
assert(typeof realStderrGetter === 'function');

function stdinGetter() {
  var previousZone = global.zone;
  global.zone = previousZone.root;
  try {
    Object.defineProperty(process,
                          'stdin',
                          { value: realStdinGetter() });
    return process.stdin;
  } finally {
    global.zone = previousZone;
  }
}

function stdoutGetter() {
  var previousZone = global.zone;
  global.zone = previousZone.root;
  try {
    Object.defineProperty(process,
                          'stdout',
                          { value: realStdoutGetter() });
    return process.stdout;
  } finally {
    global.zone = previousZone;
  }
}

function stderrGetter() {
  var previousZone = global.zone;
  global.zone = previousZone.root;
  try {
    Object.defineProperty(process,
                          'stderr',
                          { value: realStderrGetter() });
    return process.stderr;
  } finally {
    global.zone = previousZone;
  }
}

Object.defineProperties(process, {
  stdin: {get: stdinGetter, configurable: true},
  stdout: {get: stdoutGetter, configurable: true},
  stderr: {get: stderrGetter, configurable: true}
});
