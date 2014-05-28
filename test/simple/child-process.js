
require('../common.js');

var assert = require('assert');
var exec = require('child_process').exec;
var execFile = require('child_process').execFile;
var spawn = require('child_process').spawn;
var Zone = zone.Zone;


var callbackCount = 0;

process.on('exit', function() {
  assert(callbackCount === 6);
});


var spawnZone = zone.create(function SpawnZone() {
  setTimeout(function() {
    callbackCount++;
    assert(zone === spawnZone);

    throw new Error('expected error');
  });

  var p = spawn('cat', ['-']);
  p.on('close', onClose);

  function onClose(code, signal) {
    callbackCount++;
    assert(zone === spawnZone);
    assert(signal === 'SIGKILL');
  }

}).catch (function(err) {
  callbackCount++;
  assert(zone === zone.root);
  assert(/expected/.test(err));
});


var execZone = zone.create(function ExecZone() {
  exec('echo hello world', callback);

  function callback(err, stdout, stderr) {
    callbackCount++;
    assert(zone === execZone);
    assert(!err);
    assert(/hello world/.test(stdout));
  }
});


var execFileZone = zone.create(function ExecFileZone() {
  execFile('inv$alid~file', [], callback);

  function callback(err, stdout, stderr) {
    callbackCount++;
    assert(zone === execFileZone);
    throw err;
  }

}).catch (function(err) {
  callbackCount++;
  assert(err.code === 'ENOENT');
});


