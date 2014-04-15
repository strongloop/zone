
module.exports = LinkedList;


var assert = require('assert');


function LinkedList(name) {
  var head = this;

  if (name == null)
    name = '';
  else
    name = name + '';

  // Todo: use ES6 symbols for this.
  var next = '__next_' + name + '__';
  var prev = '__prev_' + name + '__';

  // Make it an empty list
  this[prev] = this;
  this[next] = this;

  this.push = function(object) {
    assert(object[prev] == null);
    assert(object[next] == null);

    object[prev] = head[prev];
    object[next] = head;

    head[prev][next] = object;
    head[prev] = object;
  };

  this.pop = function() {
    var object = head[prev];
    if (object === head)
      return null;

    var last = head[prev] = object[prev];
    last[next] = head;

    object[prev] = null;
    object[next] = null;

    return object;
  };

  this.unshift = function(object) {
    assert(object[prev] == null);
    assert(object[next] == null);

    object[prev] = head;
    object[next] = head[next];

    head[next][prev] = object;
    head[next] = object;
  };

  this.shift = function() {
    var object = head[next];
    if (object === head)
      return null;

    var first = head[next] = object[next];
    first[prev] = head;

    object[prev] = null;
    object[next] = null;

    return object;
  };

  this.remove = function(object) {
    assert(object[prev] !== null);
    assert(object[next] !== null);

    object[prev][next] = object[next];
    object[next][prev] = object[prev];

    object[prev] = null;
    object[next] = null;
  };

  this.empty = function() {
    return head[next] === head;
  };
}


