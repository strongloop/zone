
if (!process._rawDebug) {
  var write = process.binding('fs').write;
  var util = require('util');

  process._rawDebug = function _rawDebug(string) {
    var buf = new Buffer(string + '\n');
    write(2, buf, 0, buf.length);
  };
}
