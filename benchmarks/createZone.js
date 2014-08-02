benchmark = require('./benchmark.js');
require('../lib/setup.js').enable();
Error.stackTraceLimit = 0;

function foo() {}

function benchNextTick(next) {
  zone.create(foo, next);
}

benchmark.startBenchmark('zone.create', benchNextTick);
