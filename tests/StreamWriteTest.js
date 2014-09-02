var Zone = require('../lib/Setup.js').enable();
var Zone = zone.Zone;
var net = require('net');

exports.testWriterFromRootZone = function(test) {
  process.stdout.cork();
  test.expect(1);
  process.stdout.write('Write from root zone\n', function() {
    test.strictEqual(zone, zone.root);
    test.done();
  });
  process.stdout.uncork();
};

exports.testWriterFromChildZone = function(test) {
  process.stdout.cork();
  test.expect(2);
  var writeZone = zone.create(function WriteZone() {
    process.stdout.write('Write from child zone\n', function() {
      test.strictEqual(zone, writeZone);
      test.notStrictEqual(zone, zone.root);
    });
  }).then(function() { test.done(); });
  process.stdout.uncork();
};


exports.testWriteCallbacksAreMadeInTheRightZone = function(test) {
  zone.create(function TestZone() {
    var server = net.createServer(function(conn) {
      var zone1 = zone.create(function Zone1() {
        var afterWrite = function afterWrite() {
          test.ok(zone === zone1);
        };

        conn.write('small', afterWrite);
      });

      var zone2 = zone.create(function Zone2() {
        var afterWrite = function afterWrite() {
          test.ok(zone === zone2);
        };

        var string = new Array(1024 * 1024).join('x');
        conn.write(string, afterWrite);
      });

      var zone3 = zone.create(function Zone3() {
        var afterEnd = function afterEnd() {
          test.ok(zone === zone3);
        };

        var buf = new Buffer(1024 * 1024);
        buf.fill(42);
        conn.end(buf, afterEnd);
      });

      server.close();
    });

    server.listen(0);

    var conn = net.connect(server.address().port);
    conn.resume();

  }).then(function() {
    console.log('all done');
    test.done();
  });
};
