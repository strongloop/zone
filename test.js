var fs = require('fs');
var net = require('net');
var z = require('./');
var EventEmitter = require('events').EventEmitter;

var debug = process.env.DEBUG || true ? console.log : function() {};

debug('Start');

var calledBack = true;

Try('top-level zone does not work');

new z.Zone(function() {
  assert(zone.root);
  this.parent = zone.root;
}, Should('do something?'));

Try('zone can return values');

new z.Zone(function() {
  var _ = new z.Zone(function() {
    zone.return('hi');
  }, Should('result in hi', 'hi'));
});

Try('zones catch direct errors');

new z.Zone(function() {
  var _ = new z.Zone(function() {
    throw Error('bye');
  }, Should('error'), undefined, Error('bye'));
});

Try('zones catch indirect errors');

new z.Zone(function() {
  var _ = new z.Zone(function() {
    process.nextTick(function() {
      throw Error('bye');
    });
  }, Should('error'));
});

Try('zones catch error events');

new z.Zone(function() {
  var _ = new z.Zone(function() {
    var ee = new EventEmitter();
    process.nextTick(function() {
      ee.emit('error', Error('bye'));
    });
  }, Should('error'));
});

Try('zones wait for handles');

new z.Zone(function() {
  var _ = new z.Zone(function() {
    var ee = net.createServer().listen(0);
    this.throw(Error('bye'));
    setTimeout(function() {
      debug('Release zone');
      ee.close();
      this.return('will be overriden by error');
    }, 100);
  }, Should('error'));
});

Try('nested zone w/fs.zstat:');

new z.Zone(function() {
  var _ = new z.Zone(function() {
    fs.zstat('.', this.callback);
  }, Should('result in stat'));
});

Try('nested zone w/setTimeout direct cb:');

new z.Zone(function notreallyroot() {
  var _ = new z.Zone(function myzone() {
    setTimeout(function() {
      zone.return('ok');
    }, 1);
  }, Should('result in ok'));
});

Try('nested zone w/setTimeout indirect cb:');

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
  }, Should('result in ok'));
});

End();

function slice() {
  var aray = arguments[0];
  var args = Array.prototype.slice.call(arguments, 1);
  return Array.prototype.slice.apply(aray, args);
}

function End() {
  if (!calledBack) {
    console.log('... did not call back!');
  }
  console.log('End');
}

function Try(something) {
  End();

  debug('Try:', something);
  calledBack = false;
}

function Should(name) {
  return function() {
    calledBack = true;
    var err = arguments[0];
    var res = arguments[1];
    var etc = slice(arguments, 2);
    console.log('callback should %s: err<%s>, result<%s>, ...:',
      name, err && err.message, res, etc);
  };
}
