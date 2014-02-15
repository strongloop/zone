var tap = require('./tap');

var assert = require('assert');
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var Gate = zone.Gate;
var Zone = zone.Zone;

tap.test('smoke test', function(t) {
  new Zone(function outer_zone() {
    tap.log('Beginning zone %s', zone.name);

    var n = 5;
    var iv = setInterval(function() {
      tap.log('setInterval callback in zone %s. Left: %s', zone.name, n--);
      if (n === 0)
        clearInterval(iv);
    }, 50);

    new Zone(function inner_zone() {
      tap.log('Beginning zone %s', zone.name);
      setTimeout(function() {
        tap.log('setTimeout callback in zone %s', zone.name);
      }, 100);
    }).setCallback(function(error) {
      tap.log('Zone inner_zone ended, back in %s. Error: ', zone.name, error);
    });

    new Zone(function stat_zone() {
      var statZone = this;
      fs.stat('bla', function(error, stats) {
        assert.strictEqual(zone, statZone);
        tap.log('stat() callback in zone %s. (error, result) = (%s, %s)', zone.name, error, stats);
        if (error)
          throw error;
      });
    }).setCallback(function(error) {
      tap.log('Zone stat_zone ended, back in %s. Error: %s', zone.name, error);
      if (error) throw error;
    });

  }).setCallback(function(error, result) {
    tap.log('Zone outer_zone ended, back in %s. Error: %s', zone.name, error);
    if (error) throw error;
  });

  /* XXX(sam) doesn't pass with EventEmitter patching, and the EventEmitter
   * breaks node-tap... consider it a use-case :-)
  new Zone(function() {
    var ee = new EventEmitter();

    new Zone(function() {
      ee.on('test', function() {
        tap.log('bla');
      });
    });

    ee.emit('test');
  });
   */

  t.end();
});
