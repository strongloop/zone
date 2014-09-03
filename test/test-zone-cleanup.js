var Zone = require('../lib/setup.js').enable();

//In the synchronous case, zones should clean up in child -> parent order
exports.testSimpleCleanup = function(test) {
  var cleanupOrder = [];

  zone.create(function ChildZone1() {
    zone.create(function ChildZone2() {
      zone.create(function ChildZone3() {

      }).then(function() {
        cleanupOrder.push('ChildZone3');
      });
    }).then(function() {
      cleanupOrder.push('ChildZone2');
    });
  }).then(function() {
    cleanupOrder.push('ChildZone1');
    test.deepEqual(cleanupOrder, ['ChildZone3', 'ChildZone2', 'ChildZone1']);
    test.done();
  });
};

//In the synchronous case, zones should clean up in child -> parent order
exports.testErrorCatch = function(test) {
  var cleanupOrder = [];
  var Zone = zone.Zone;
  Zone.longStackSupport = true;

  zone.create(function ChildZone1() {
    zone.create(function ChildZone2() {
      zone.create(function ChildZone3() {
        throw new Error('monkey wrench');
      }).catch (function() {
        cleanupOrder.push('ChildZone3');
      });
    }).then(function() {
      cleanupOrder.push('ChildZone2');
    });
  }).then(function() {
    cleanupOrder.push('ChildZone1');
    test.deepEqual(cleanupOrder, ['ChildZone3', 'ChildZone2', 'ChildZone1']);
    test.done();
  });
};

//If children dont have a catch block, errors should propogate to parent
exports.testErrorPropogation = function(test) {
  var cleanupOrder = [];
  var Zone = zone.Zone;
  Zone.longStackSupport = true;

  zone.create(function ChildZone1() {
    zone.create(function ChildZone2() {
      zone.create(function ChildZone3() {
        nextTick(function() {
          throw new Error('monkey wrench');
        });
      });
    });
  }).catch (function() {
    test.ok(true, 'Error was propogated');
    test.done();
  });
};

//FS ops can't be cancelled. So Zone should wait for it
exports.testErrorExitWaitsForFsStat = function(test) {
  var cleanupOrder = [];
  var Zone = zone.Zone;
  var fs = require('fs');
  Zone.longStackSupport = true;

  zone.create(function ChildZone1() {
    zone.create(function ChildZone2() {
      zone.create(function ChildZone3() {
        fs.stat('./assets/file1', function() {
          cleanupOrder.push('fs.stat complete');
        });

        throw new Error('monkey wrench');
      }).catch (function() {
        cleanupOrder.push('exception caught');
      });
    });
  }).then(function() {
    test.deepEqual(cleanupOrder, ['fs.stat complete', 'exception caught']);
    test.done();
  });
};

//Zones should wait for async operations before completing
exports.testCleanExitWaitsForFsStat = function(test) {
  var cleanupOrder = [];
  var Zone = zone.Zone;
  var fs = require('fs');
  Zone.longStackSupport = true;

  zone.create(function ChildZone1() {
    zone.create(function ChildZone2() {
      zone.create(function ChildZone3() {
        fs.stat('./assets/file1', function() {
          cleanupOrder.push('fs.stat complete');
        });

      }).then(function() {
        cleanupOrder.push('ChildZone3 exit');
      });
    });
  }).then(function() {
    test.deepEqual(cleanupOrder, ['fs.stat complete', 'ChildZone3 exit']);
    test.done();
  });
};

//Timeouts can be cancelled so Zone should not wait for it
exports.testErrorExitCancelsTimeout = function(test) {
  var cleanupOrder = [];
  var Zone = zone.Zone;
  var fs = require('fs');
  Zone.longStackSupport = true;

  zone.create(function ChildZone1() {
    zone.create(function ChildZone2() {
      zone.create(function ChildZone3() {
        process.setTimeout(function() {
          cleanupOrder.push('timeout complete');
        }, 5000);

        throw new Error('monkey wrench');
      }).catch (function() {
        cleanupOrder.push('exception caught');
      });
    });
  }).then(function() {
    test.deepEqual(cleanupOrder, ['exception caught']);
    test.done();
  });
};

//If there is no error, Zones should wait for timeouts
exports.testCleanExitWaitsForTimeout = function(test) {
  var cleanupOrder = [];
  var Zone = zone.Zone;
  var fs = require('fs');
  Zone.longStackSupport = true;

  zone.create(function ChildZone1() {
    zone.create(function ChildZone2() {
      zone.create(function ChildZone3() {
        setTimeout(function() {
          cleanupOrder.push('timeout complete');
        }, 50);
      }).then(function() {
        cleanupOrder.push('ChildZone3 exit');
      });
    });
  }).then(function() {
    test.deepEqual(cleanupOrder, ['timeout complete', 'ChildZone3 exit']);
    test.done();
  });
};

//A throw within a zone should cause the listener to unregister from the emitter
exports.testEventEmitterCleanup = function(test) {
  var EventEmitter = require('events').EventEmitter;
  var cleanupOrder = [];

  zone.create(function ChildZone1() {
    var emitter = new EventEmitter();

    zone.create(function ChildZone() {
      emitter.on('event', function() {
        cleanupOrder.push('event reveived');
      });
      emitter.on('throw', function() {
        cleanupOrder.push('throw reveived');
        throw new Error('monkey wrench');
      });
    }).catch (function(err) {
      cleanupOrder.push('ChildZone exited');
    });

    process.nextTick(function() {
      emitter.emit('event', 'foo');
    });
    process.nextTick(function() {
      emitter.emit('throw', 'foo');
    });
    setTimeout(function() {
      //this event should not trigger the listener
      emitter.emit('event', 'foo');
    }, 50);
  }).then(function() {
    test.deepEqual(cleanupOrder,
        ['event reveived', 'throw reveived', 'ChildZone exited']);
    test.done();
  });
};

exports.testAsyncEventCleanup = function(test) {
  outer = zone.create(function Outer() {
    process.nextTick(createMiddleZone);
  });

  function createMiddleZone() {
    zone.create(function() {
      this.name = 'In the middle';
      failAsync(1);
    });
  }

  var failAsync = zone.define(function AsyncFailZone(timeout) {
    setTimeout(function() {
      function_that_doesnt_exist();
    }, timeout);
  });

  outer.setCallback(function(err, res) {
    test.ok(err !== null);
    test.done();
  });
};
