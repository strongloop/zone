
// Create the root zone and enter it.
var RootZone = require('./Zone.js').RootZone;
zone = module.exports = new RootZone();

// Monkey-patch require()
require('./require.js');
