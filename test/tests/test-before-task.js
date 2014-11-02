require('../common.js');

test.expect(2);

var beforeHook = function() {
  test.ok(true, 'expecting a call');
};

zone.create(function() {
  test.ok(test, 'running the main function');
  test.done();
}, { beforeTask: beforeHook });
