
require('../common.js');

var assert = require('assert');
var fs = require('fs');
var resolve = require('path').resolve;
var Zone = zone.Zone;


var callbackCount = 0;

process.on('exit', function() {
  assert(callbackCount === 3);
});


var fileName1 = resolve(__dirname, '../temp', 'file1');
var fileName2 = resolve(__dirname, '../temp', 'file2');
var fd1, fd2;

new Zone(function() {
  new Zone(function() {
    fs.open(fileName1, 'w+', function(err, fd) {
      callbackCount++;

      if (err)
        throw err;
      fd1 = fd;
    });

    throw new Error('expected error');

  }).catch (function(err) {
    callbackCount++;
    assert(/expected/.test(err));
  });

  new Zone(function() {
    fd2 = fs.openSync(fileName2, 'w+');
  });

}).then(function() {
  callbackCount++;
  assertFileClosed(fd1);
  assertFileClosed(fd2);
});

function assertFileClosed(fd) {
 try {
    fs.fstatSync(fd);
    assert.fail();
  } catch (err) {
    console.log(err.zoneStack);
    assert(err.code === 'EBADF');
  }
}
