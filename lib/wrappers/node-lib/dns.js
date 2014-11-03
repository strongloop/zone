%nativeSource;


/* This is a partial workaround for
 * https://github.com/joyent/node/issues/8664
 */

makeAsync = function makeAsync(callback) {
  if (typeof callback !== 'function') {
    return callback;
  }
  return function asyncCallback() {
    if (asyncCallback.immediately) {
      // The API already returned, we can invoke the callback immediately.
      callback.apply(null, arguments);
    } else {
      var args = arguments;
      setTimeout(function() {
        callback.apply(null, args);
      }, 0);
    }
  };
};
