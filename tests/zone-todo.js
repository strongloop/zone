var tap = require('./tap');
var net = require('net');
var EventEmitter = require('events').EventEmitter;

tap.test('zones wait for handles', function(t) {
  new zone.Zone(function() {
    var ee = net.createServer().listen(0);
    this.throw(Error('bye'));
    setTimeout(function() {
      ee.close();
      this.return('will be overriden by error');
    }, 10);
  }, function(err) {
    t.equal(err.message, 'bye', '# TODO');
    t.end();
  });
});

tap.test('zones catch error events', function(t) {
  t.ok(false, '# TODO')
  t.end()
  return; // the error event just kills tap :-(

  new zone.Zone(function() {
    var ee = new EventEmitter();
    process.nextTick(function() {
      ee.emit('error', Error('bye'));
    });
  }, function(err) {
    t.equal(err.message, 'bye', '# TODO');
    t.end();
  });
});

