var tap = require('./tap');

var assert = require('assert');
var fs = require('fs');
var net = require('net');
var EventEmitter = require('events').EventEmitter;

var debug = tap.log;

debug('zone:', zone);

var ROOT = zone;

function isZone5(t, z, root, parent, name) {
  t.ok(z, 'should exist');
  t.is(z.root, root, 'should be root');
  t.is(z.parent, parent, 'should have no parent');
  t.is(z.name, name, 'should be named');
  t.type(z.id, 'number', 'should have a numeric id');
}

tap.test('root zone', function(t) {
  t.plan(5+1);
  isZone5(t, zone, zone, null, 'Root');
  t.is(zone.id, 1);
});

tap.test('new zone', function(t) {
  t.plan(5+3);
  var inside;
  var outside = new zone.Zone(function() {
    isZone5(t, zone, ROOT, ROOT, 'Anonymous');
    inside = zone;
    t.not(zone, ROOT);
  });
  t.is(inside, outside);
  t.is(zone, ROOT);

  t.end();
});

/*

tap.test('zone can return values', function(t) {

  new z.Zone(function() {
    var _ = new z.Zone(function() {
      zone.return('hi');
    }, Should(t, 'result in hi', 'hi'));
  });

});

tap.test('zones catch direct errors', function(t) {

  new z.Zone(function() {
    var _ = new z.Zone(function() {
      throw Error('bye');
    }, Should(t, 'error'), undefined, Error('bye'));
  });

});

tap.test('zones catch indirect errors', function(t) {

  new z.Zone(function() {
    var _ = new z.Zone(function() {
      process.nextTick(function() {
        throw Error('bye');
      });
    }, Should(t, 'error'));
  });

});

tap.test('zones catch error events', function(t) {

  new z.Zone(function() {
    var _ = new z.Zone(function() {
      var ee = new EventEmitter();
      process.nextTick(function() {
        ee.emit('error', Error('bye'));
      });
    }, Should(t, 'error'));
  });

});

tap.test('zones wait for handles', function(t) {

  new z.Zone(function() {
    var _ = new z.Zone(function() {
      var ee = net.createServer().listen(0);
      this.throw(Error('bye'));
      setTimeout(function() {
        debug('Release zone');
        ee.close();
        this.return('will be overriden by error');
      }, 100);
    }, Should(t, 'error'));
  });

});

tap.test('nested zone w/fs.zstat:', function(t) {

  new z.Zone(function() {
    var _ = new z.Zone(function() {
      fs.zstat('.', this.callback);
    }, Should(t, 'result in stat'));
  });

});

tap.test('nested zone w/setTimeout direct cb:', function(t) {

  new z.Zone(function notreallyroot() {
    var _ = new z.Zone(function myzone() {
      setTimeout(function() {
        zone.return('ok');
      }, 1);
    }, Should(t, 'result in ok'));
  });

});

tap.test('nested zone w/setTimeout indirect cb:', function(t) {

  new z.Zone(function() {
    var _ = new z.Zone(function() {
      setTimeout(function() {
        // XXX this is bound to gate's 'outside' zone, but since this is lost if
        // callback is cb.bind(<someobj>), and since this is also lost if you call
        // a helper function, I think there should be a 'current zone' globally
        // somewhere
        var zone = this;
        function doIt() {
          zone.return('ok');
        }
        doIt();
      }, 1);
    }, Should(t, 'result in ok'));
  });
});

function slice() {
  var aray = arguments[0];
  var args = Array.prototype.slice.call(arguments, 1);
  return Array.prototype.slice.apply(aray, args);
}
*/

function Should(t, name) {
  return function() {
    calledBack = true;
    var err = arguments[0];
    var res = arguments[1];
    var etc = slice(arguments, 2);
    tap.log('callback should %s: err<%s>, result<%s>, ...:',
      name, err && err.message, res, etc);
    t.end();
  };
}
