var tap = require('./tap');
var fs = require('fs');

tap.test('fs.stat', function(t) {
  new zone.Zone(function() {
    fs.stat('.', zone.callback);
  }, function(err, stat) {
    t.ok(stat.isDirectory());
    t.end();
  });
});
