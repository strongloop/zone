require('./_common.js');

var dns = require('dns');

test.expect(3);
zone.create(function ChildZone() {
  var childZone = zone;
  var async = false;

  dns.resolve('localhost', function(err, addresses) {
    test.ok(err || typeof addresses === 'object');
    test.ok(zone === childZone);
    test.ok(async);
  });

  async = true;

}).then(function() {
  test.done();
});
