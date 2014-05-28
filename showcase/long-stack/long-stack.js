require('../../').enable(); // enable zones

var Zone = zone.Zone;

zone.create(function Outer() {
  process.nextTick(createMiddleZone);
});

function createMiddleZone() {
  zone.create(function() {
    this.name = 'In the middle';
    failAsync(1);
  });
}

function failAsync(timeout) {
  zone.create(function AsyncFailZone(timeout) {
    setTimeout(function() {
      function_that_doesnt_exist();
    }, timeout);
  });
}
