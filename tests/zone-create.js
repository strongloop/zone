var tap = require('./tap');

var ROOT = zone;

function isZone5(t, z, root, parent, name) {
  t.ok(z, 'should exist');
  t.is(z.root, root, 'should be root');
  t.is(z.parent, parent, 'should have no parent');
  t.is(z.name, name, 'should be named');
  t.type(z.id, 'number', 'should have a numeric id');
}

tap.test('root zone', function(t) {
  t.plan(5 + 1);
  isZone5(t, zone, zone, null, 'Root');
  t.is(zone.id, 1);
});

function testCreateZone(description, ctor) {
  tap.test(description, function(t) {
    t.plan(5 + 3);
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
    return callback();
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
