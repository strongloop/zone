var Zone = require('../../').Zone;


demo();

function demo() {
  new Zone(function Outer() {
    new Zone(function() {
      this.name = 'In the middle';
      failAsync(1);
    });
  });
}

function failAsync(timeout) {
  new Zone(function AsyncFailZone(timeout) {
    setTimeout(function() {
      function_that_doesnt_exist();
    }, timeout);
  });
}
