// TODO:
//   * The process object is an EventEmitter. Make it hebave properly in the
//     context of zones.
//   * `process.on('SIGxxx', cb)` implicitly constructs a signal watcher -
//      decide what to do with that (add to the root zone and unref?)
//   * Investigate what the zone implications are for
//     - cluster messaging: `process.on('message')`
//     - lazily constructed stdio streams: `process.stdin`, `stdout`, `stderr`

process.nextTick = function nextTick(cb) {
  zone.schedule(cb, global);
};
