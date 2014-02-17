
process.nextTick = function nextTick(cb) {
  zone.schedule(cb, global);
};
