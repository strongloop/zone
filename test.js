var tap = require('./tap');

var assert = require('assert');
var fs = require('fs');
var net = require('net');
var EventEmitter = require('events').EventEmitter;

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

tap.test('zone properties after creating', function(t) {
  function testCreateZone(description, ctor) {
    tap.test(description, function (t) {
      t.plan(5+3);
      var inside;
      var outside = ctor(function() {
        isZone5(t, zone, ROOT, ROOT, ctor.expectedName);
        inside = zone;
        t.not(zone, ROOT);
      });
      t.is(inside, outside);
      t.is(zone, ROOT);

      t.end();
    });
  }

  testCreateZone('new anonymous zone', function ctor(callback) {
    ctor.expectedName = 'Anonymous';
    return new zone.Zone(function() {
      return  callback();
    });
  });

  testCreateZone('wrapped anonymous zone', function ctor(callback) {
    ctor.expectedName = 'Anonymous';
    return zone.Zone(function() {
      return callback();
    })();
  });

  testCreateZone('new named zone', function ctor(callback) {
    ctor.expectedName = 'myName';
    return new zone.Zone(function myName() {
      return callback();
    });
  });

  testCreateZone('wrapped named zone', function ctor(callback) {
    ctor.expectedName = 'myName';
    return zone.Zone(function myName() {
      return callback();
    })();
  });
  t.end();
});


tap.test('zone can return values', function(t) {
  t.plan(3);

  new zone.Zone(function() {
    zone.return('hi');
  }, returns3(t, 'hi'));
});


function returns3(t, res, etc) {
  etc = etc || [];

  return function(err_, res_) {
    var etc_ = slice(arguments, 2);
    t.equal(err_, null);
    t.deepEqual(res_, res);
    t.deepEqual(etc_, etc);
  };
}

function slice() {
  var aray = arguments[0];
  var args = Array.prototype.slice.call(arguments, 1);
  return Array.prototype.slice.apply(aray, args);
}

/*

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

*/
