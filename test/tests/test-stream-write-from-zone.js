require('../common.js');

test.expect(1);

if (!isv010)
  process.stdout.cork();

process.stdout.write('Write from root zone\n', function() {
  test.strictEqual(zone, zone.root);
  test.done();
});

if (!isv010)
  process.stdout.uncork();
