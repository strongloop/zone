

var isWindows = process.platform === 'win32';
var fs = require('fs');
var net = require('net');
var path = require('path');
var prefix = isWindows ? '\\\\?\\pipe'
                       : '/tmp';

var pipeNames = fs.readdirSync(prefix);

pipeNames = pipeNames.filter(function(name) {
  return /^%node-zone-debug-/.test(name);
}).map(function(name) {
  return prefix + path.sep + name;
});

dumpNext();

function dumpNext() {
  var pipeName = pipeNames.shift();

  if (!pipeName)
    return;

  var conn = net.connect(pipeName, { allowHalfOpen: true });
  conn.end();
  conn.pipe(process.stdout);
  conn.on('error', function() {});
  conn.on('close', dumpNext);
}
