
exports.enable = function() {
  // Create the root zone and enter it.
  var RootZone = require('./Zone.js').RootZone;
  zone = new RootZone();

  require('./bind.js');

  // Monkey-patch process.binding
  require('./binding.js');

  // Monkey-patch globals
  require('./dom-globals.js');

  // Monkey-patch some stream methods
  require('./stream.js');

  // Monkey-patch require()
  require('./require.js');

  // Monkey-patch the process object
  // (only process.nextTick for now)
  require('./process.js');

  // Add long stack trace support to Error objects
  require('./error.js');

  // Create the debugger server.
  require('./debug.js');
};
