

require('../common.js');

var assert = require('assert');
var Zone = zone.Zone;

var callbackCount = 0;

process.stdout.cork();

process.stdout.write('Write from root zone\n', function() {
  callbackCount++;

  assert.strictEqual(zone, zone.root);
});


var writeZone = new Zone(function WriteZone() {
  process.stdout.write('Write from child zone\n', function() {
    callbackCount++;

    assert(zone === writeZone);
    assert(zone !== zone.root);
  });
});

process.stdout.uncork();

process.on('exit', function() {
  assert(callbackCount === 2);
});
