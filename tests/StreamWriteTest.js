var Zone = require('../lib/Setup.js').enable();
var Zone = zone.Zone;

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
