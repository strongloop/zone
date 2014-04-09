var Zone = require('../').Zone; // require('zone');

var net = require('net');

new Zone(function server_zone() {
  var server = net.createServer(function(conn) {

  });

  server.listen(3000);
});


for (var i = 0; i < 10; i++) {
  new Zone(function connection_zone() {
    var conn = net.connect(3000, function() {
      new Zone(function interval_zone() {
        setInterval(function() {
          conn.write('hello');
        }, 1);
      });
    });
  }).setCallback(function(error) {
  });
}
