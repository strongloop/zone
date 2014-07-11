benchmark = require('./benchmark.js');
require('../lib/Setup.js').enable();

function benchNextTick(next) {
  process.nextTick(next); // Or fs.exists, whatever
}

benchmark.startBenchmark('nextTick w/ zones', benchNextTick);
