var realBinding = process.binding;
var bindingCache = {};

process.binding = binding;

function binding(name) {
  if (name in bindingCache)
    return bindingCache[name];

  var wb;

  switch (name) {
    case 'pipe_wrap':
    case 'tcp_wrap':
    case 'tty_wrap':
      wb = require('./binding/stream_wrap.js')(realBinding);
      bindingCache.pipe_wrap = wb;
      bindingCache.tcp_wrap = wb;
      bindingCache.tty_wrap = wb;
      return wb;

    case 'cares_wrap':
    case 'fs':
    case 'process_wrap':
    case 'zlib':
      wb = require('./binding/' + name + '.js')(realBinding);
      bindingCache[name] = wb;
      return wb;

    default:
      return realBinding(name);
  }
}
