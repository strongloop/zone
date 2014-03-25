
var realBinding = process.binding;
var bindingCache = Object.create(null);

process.binding = binding;

function binding(name) {
  if (name in bindingCache)
    return bindingCache[name];

    default:
      return realBinding(name);
  }
}
