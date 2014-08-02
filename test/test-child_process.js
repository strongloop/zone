var Zone = require('../lib/setup.js').enable();
var assert = require('assert');
var Zone = zone.Zone;

var exec = require('child_process').exec;
var execFile = require('child_process').execFile;
var spawn = require('child_process').spawn;

exports.testProcessSpawnCleanuponException = function(test) {
  test.expect(4);
  var zoneFunc = function SpawnZone() {
    function onClose(code, signal) {
      test.ok(true);
    }

    var p = spawn('cat', ['-']);
    p.on('close', onClose);

    setTimeout(function() {
      test.strictEqual(zone, spawnZone);
      throw new Error('expected error');
    });
  };
  var cb = function(err) {
    test.strictEqual(zone, zone.root);
    test.ok(/expected/.test(err));
    test.done();
  };
  var spawnZone = zone.create(zoneFunc).catch (cb);
};

exports.testProcessExecInZone = function(test) {
  test.expect(3);
  var execZone = zone.create(function ExecZone() {
    exec('echo hello world', callback);

    function callback(err, stdout, stderr) {
      test.strictEqual(zone, execZone);
      test.ok(!err);
      test.ok(/hello world/.test(stdout));
    }
  }).then(function() { 
    test.done(); 
  });
};

exports.testProcessExecFailureInZone = function(test) {
  test.expect(2);
  var zoneFunc = function ExecFileZone() {
    execFile('inv$alid~file', [], callback);

    function callback(err, stdout, stderr) {
      test.strictEqual(zone, execFileZone);
      throw err;
    }
  };

  var errorFunc = function(err) {
    test.strictEqual(err.code, 'ENOENT');
    test.done();
  };

  var execFileZone = zone.create(zoneFunc).catch (errorFunc);
};
