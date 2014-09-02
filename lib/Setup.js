exports.enable = function() {
  if (!global.zone) {
    var RootZone = require('./Zone.js').RootZone;
    global.zone = new RootZone();

    require('./wrappers/binding.js');
    require('./wrappers/dom-globals.js');
    require('./wrappers/stream.js');
    require('./wrappers/require.js');
    require('./wrappers/events.js');
    require('./wrappers/process.js');
    require('./Error.js');
    require('./Debug.js');

    console.error('Zones are enabled. ' +
                  'See \x1b[1;34mhttp://strongloop.com/zone\x1b[0m ' +
                  'for more information.');
  }
};
