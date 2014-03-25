module.exports = debuglog;

var util = require('util');
var debugs = {};
var debugEnviron = process.env.NODE_DEBUG || '';

function debuglog(set) {
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = util.format.apply(exports, arguments);
        process._rawDebug('%s %s: %s', set, zone ? zone.name : '?', msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
}
