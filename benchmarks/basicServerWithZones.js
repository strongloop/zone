var http = require('http');
require('../lib/Setup.js').enable();
Error.stackTraceLimit = 0;

var numRequests = 1;
var start = 0;

http.createServer(function(req, res) {
  if (numRequests === 1) {
    start = Date.now();
  }else if (numRequests >= 100000) {
    var end = Date.now();
    var perSec = numRequests / (end - start) * 1000;
    console.log('ops/sec: %d (basic node server with zones loaded)', perSec);
    process.exit(0);
  }
  ++numRequests;
  res.writeHead(200);
  res.end('hi');
}).listen(3001);
