
// Define the Error.zoneStack property.

function getZoneStack() {
  var r = this.stack;

  for (var zone = this.zone;
       zone && zone.parent;
       zone = zone.parent)
    r += '\n\nIn zone: ' + zone.stack;

  return r;
}

Object.defineProperty(Error.prototype,
                      'zoneStack',
                      { get: getZoneStack });
