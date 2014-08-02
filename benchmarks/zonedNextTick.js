benchmark = require('./benchmark.js');
require('../lib/setup.js').enable();

function benchNextTick(next) {
  process.nextTick(next); // Or fs.exists, whatever
}

benchmark.startBenchmark('nextTick w/ zones', benchNextTick);
