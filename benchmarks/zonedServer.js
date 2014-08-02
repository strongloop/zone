var http = require('http');
require('../lib/setup.js').enable();
//require('../../zone/lib/setup.js').enable();
zone.Zone.longStackSupport = false

var numRequests = 1;
var start = 0;

function RequestHandler(req, res) {
  zone.create(RequestZone, {arguments: [req, res]});
}

function RequestZone(req, res){
    if (numRequests === 1) {
      start = Date.now();
    }else if (numRequests >= 100000) {
      var end = Date.now();
      var perSec = numRequests / (end - start) * 1000;
      console.log('ops/sec: %d (server with each request running in a zone)', perSec);
      process.exit(0);
    }
    ++numRequests;
    res.writeHead(200);
    res.end('hi');
  }

http.createServer(RequestHandler).listen(3001);
