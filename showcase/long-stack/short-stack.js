var Zone = require('../../').Zone;


process.nextTick(doSomethingAsync);

function doSomethingAsync() {
  failAsync(1);
}

function failAsync(timeout) {
  setTimeout(function() {
    function_that_doesnt_exist();
  }, timeout);
}
