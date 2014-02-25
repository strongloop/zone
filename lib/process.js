// TODO:
//   * The process object is an EventEmitter. Make it hebave properly in the
//     context of zones.
//   * `process.on('SIGxxx', cb)` implicitly constructs a signal watcher -
//      decide what to do with that (add to the root zone and unref?)
//   * Investigate what the zone implications are for
//     - cluster messaging: `process.on('message')`
//     - lazily constructed stdio streams: `process.stdin`, `stdout`, `stderr`

var Gate = zone.Gate;
var realNextTick = process.nextTick;


process.nextTick = Gate(function nextTick(cb) {
  var gate = this;
  realNextTick(function() {
    gate.call(cb);
    gate.close();
  });
});
