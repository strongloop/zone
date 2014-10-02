
process.on('uncaughtException', function(e) {
  process._rawDebug(e.stack);
})

require('./').enable();

zone.create(function() {});

console.log('hello');
process.stdin.pipe(process.stdout);