var LinkedList = require('../lib/linked-list.js');

exports.pushPop = function(test) {
  var l = new LinkedList('test');
  for (var i = 0; i < 10; i++) {
    l.push(i);
  }

  for (i = 9; i >= 0; i--) {
    test.equal(l.pop(), i);
  }

  test.equal(l.pop(), null);
  test.done();
};

exports.shiftUnshift = function(test) {
  var l = new LinkedList('test');
  for (var i = 0; i < 10; i++) {
    l.unshift(i);
  }

  for (i = 9; i >= 0; i--) {
    test.equal(l.shift(), i);
  }

  test.equal(l.shift(), null);
  test.done();
};

exports.head = function(test) {
  var l = new LinkedList('test');
  for (var i = 0; i < 10; i++) {
    l.push(i);
  }

  for (i = 0; i < 10; i++) {
    test.equal(l.head(), i);
    l.shift();
  }

  test.equal(l.head(), null);
  test.done();
};

exports.tail = function(test) {
  var l = new LinkedList('test');
  for (var i = 0; i < 10; i++) {
    l.push(i);
  }

  for (i = 9; i >= 0; i--) {
    test.equal(l.tail(), i);
    l.pop();
  }

  test.equal(l.tail(), null);
  test.done();
};

exports.remove = function(test) {
  var l = new LinkedList('test');
  for (var i = 0; i < 10; i++) {
    l.push({value: i});
  }

  x = l.head();
  l.remove(x);
  test.equal(l.head().value, 1);

  x = l.tail();
  l.remove(x);
  test.equal(l.tail().value, 8);

  i = l.iterator();
  i.next();
  i.next();
  i.next();
  x = i.next();
  l.remove(x);

  i = l.iterator();
  i.next();
  i.next();
  i.next();
  x = i.next();
  test.equal(x.value, 5);
  test.done();
};
