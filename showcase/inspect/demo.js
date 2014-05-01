var Zone = require('../../').Zone; // require('zone');
var net = require('net');


new Zone(function ServerZone() {
  var server = net.createServer(function(conn) {
    conn.resume();
  });

  server.listen(3000);
});


for (var i = 0; i < 10; i++) {
  new Zone(function ConnectionZone() {
    var conn = net.connect(3000, function() {
      new Zone(function IntervalZone() {
        setInterval(function() {
          conn.write('hello');
        }, 1);
      });
    });
  });
}
