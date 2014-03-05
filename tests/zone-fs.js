var tap = require('./tap');
var fs = require('fs');

if(true) {
  tap.test('fs.stat', function(t) {
    new zone.Zone(function() {
      fs.stat('.', zone.callback);
    }, function(err, stat) {
      t.ok(stat.isDirectory());
      t.end();
    });
  });

  tap.test('setTimeout callback is optional', function(t) {
    new zone.Zone(function() {
      setTimeout(null,100);
    }, function(err) {
      t.equal(err, null);
      t.end();
    });
  });
}

if(false) {
  tap.test('setTimeout callback is optional but delays zone close', function(t) {
    // Demonstrate that even without a timer callback, a zone doesn't complete
    // until the timer completes.
    var timer;
    new zone.Zone(function() {
      timer = setTimeout(null,100);
      console.log('timer:', timer);
      t.ok(timer._idleNext);
      // XXX(sam) Fails, wrapped gates return the gate... this isn't good, the
      // timer doesn't return a timer, and generally, a gate-wrapped thing can't
      // return the underlying function's value. maybe async calls having a return
      // value is an anti-pattern??? But Node does it!
    }, function(err) {
      t.ok(timer._idleNext, null);
      t.end();
    });
  });
}

if(true) {
  tap.test('fs.stat callback is optional', function(t) {
    new zone.Zone(function() {
      fs.stat('.');
    }, function(err) {
      if(err)
        throw err;
      t.end();
    });
  });
}


if(true) {
  tap.test('open sync fds are closed by zones', function(t) {
    t.plan(2);

    var fd;
    new zone.Zone(function() {
      fd = fs.openSync('_', 'w');
      tap.log('open fd %d', fd);
    }, function() {
      t.equal(typeof fd, 'number');
      t.throws(function() {
        fs.fstatSync(fd);
      });
    });
  });

  tap.test('close sync fds are not closed by zones', function(t) {
    t.plan(2);

    var fd;
    new zone.Zone(function() {
      fd = fs.openSync('_', 'w');
      tap.log('open fd %d', fd);
    }, function() {
      t.equal(typeof fd, 'number');
      t.throws(function() {
        fs.fstatSync(fd);
      });
    });
  });
}

if(true) {
  tap.test('open fds are closed by zones', function(t) {
    t.plan(2);

    var fd;
    new zone.Zone(function() {
      fs.open('_', 'w', function(err, _) {
        fd = _;
      });
    }, function(err, stat) {
      t.equal(typeof fd, 'number');
      t.throws(function() {
        tap.log('fs.stat:',
          fs.fstatSync(fd).size // should throw, fd should be closed
        );
      });
    });
  });
}
