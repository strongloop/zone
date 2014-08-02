// var Zone = require('../lib/setup.js').enable();
//
// exports.testBeforeTask = function(test) {
//   test.expect(2);
//   var beforeHook = function() { test.ok(true, 'expecting a call'); };
//
//   zone.create(function() { test.ok(test, 'running the main function'); },
//               {beforeTask: beforeHook});
//   test.done();
// };
//
// exports.testBeforeTaskWithError = function(test) {
//   test.expect(6);
//   var beforeHook = function() {
//     test.equal(zone.name, 'ChildZone');
//     test.ok(true, 'expecting a call');
//     throw new Error('expected error');
//   };
//
//   var failureCb = function(err) {
//     test.strictEqual(zone, zone.root);
//     test.ok(/expected/.test(err));
//     test.done();
//   };
//
//   var childZone = zone.create(function ChildZone() {
//     test.equal(global.zone.name, 'ChildZone');
//     test.ok(test, 'running the main function');
//   }, {beforeTask: beforeHook, errorCallback: failureCb});
// };
//
// exports.testAfterTask = function(test) {
//   test.expect(2);
//   var afterHook = function() { test.ok(true, 'expecting a call'); };
//
//   zone.create(function() { test.ok(test, 'running the main function'); },
//               {afterTask: afterHook});
//   test.done();
// };
