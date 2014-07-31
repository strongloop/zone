var Zone = global.zone.Zone;

function getZoneStack() {
  var r = this.stack;

  if (Zone.longStackSupport) {
    for (var zone = this.zone; zone && zone.parent; zone = zone.parent) {
      r += '\nIn zone: ' + zone.stack;
    }
  } else {
    for (var zone = this.zone; zone && zone.parent; zone = zone.parent) {
      r += '\nIn zone: ' + zone.name;
    }

    r += '\n\nNote: Long stack trace is disabled. ' +
         'SET NODE_ENV=development or set Zone.longStackSupport=true to enable it.\n';
  }

  return r;
}

Object.defineProperty(Error.prototype, 'zoneStack', {get: getZoneStack});
