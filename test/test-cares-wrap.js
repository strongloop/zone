var Zone = require('../lib/setup.js').enable();
var dns = require('dns');

// queryA
exports.testResolve4 = function(test) {
  test.expect(2);
  dns.resolve4('www.strongloop.com', function(err, addresses) {
    if (err) {
      throw err;
    }
    test.ok(typeof addresses === 'object');
    test.strictEqual(zone, zone.root);
    test.done();
  });
};

// queryAaaa
exports.testResolve6InChildZone = function(test) {
  test.expect(2);
  zone.create(function ChildZone() {
    var childZone = zone;

    dns.resolve6('www.strongloop.com', function(err, addresses) {
      if (err) {
        throw err;
      }
      test.ok(typeof addresses === 'object');
      test.strictEqual(zone, childZone);
    });
  }).then(function() { test.done(); });
};
