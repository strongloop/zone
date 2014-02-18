var tap = require('./tap');

tap.test('zone can return values', function(t) {
  t.plan(3);

  new zone.Zone(function() {
    zone.return('hi');
  }, returns3(t, 'hi'));
});

tap.test('zone can return value in timeout', function(t) {
  t.plan(3);

  new zone.Zone(function myzone() {
    setTimeout(function() {
      zone.return('ok');
    }, 1);
  }, returns3(t, 'ok'));
});

tap.test('zone can return multiple values', function(t) {
  t.plan(3);

  new zone.Zone(function() {
    zone.return('hi', 'bert');
  }, returns3(t, 'hi', ['bert']));
});

tap.test('zones catch direct errors', function(t) {
  t.plan(2);

  new zone.Zone(function() {
    throw Error('bye');
  }, errors2(t, 'bye'));
});

tap.test('zones catch indirect errors', function(t) {
  t.plan(2);
  new zone.Zone(function() {
    process.nextTick(function() {
      throw Error('bye');
    });
  }, errors2(t, 'bye'));
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

function errors2(t, emsg) {
  return function(err_) {
    t.equal(err_.message, emsg);
    t.equal(arguments.length, 1);
  };
}

function slice() {
  var aray = arguments[0];
  var args = Array.prototype.slice.call(arguments, 1);
  return Array.prototype.slice.apply(aray, args);
}
