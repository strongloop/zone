
// Create the root zone and enter it.
var RootZone = require('./Zone.js').RootZone;
zone = module.exports = new RootZone();

// Monkey-patch process.binding
require('./binding.js');

// Monkey-patch globals
require('./dom-globals.js');

// Monkey-patch require()
require('./require.js');

// Monkey-patch the process object
// (only process.nextTick for now)
require('./process.js');

// Load the zone debugger first, before actually setting up zones.
require('./debug.js');
