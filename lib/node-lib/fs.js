
var fs = require('node:fs');
var Gate = zone.Gate;

// Copy properties over from the real fs module.
for (var key in fs)
  exports[key] = fs[key];

// Monkey-patch fs.stat
exports.stat = Gate(function stat(file, cb) {
  var gate = this;
  fs.stat(file, function() {
    gate.schedule(cb, this, arguments);
    gate.close();
  });
});
