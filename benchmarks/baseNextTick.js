benchmark = require('./benchmark.js');

function benchNextTick(next) {
  process.nextTick(next); // Or fs.exists, whatever
}

benchmark.startBenchmark('nextTick', benchNextTick);
