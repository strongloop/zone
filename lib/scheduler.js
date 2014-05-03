

exports.enqueueCallback = enqueueCallback;
exports.enqueueZone = enqueueZone;
exports.dequeueZone = dequeueZone;


var assert = require('assert');
var LinkedList = require('./LinkedList.js');
var realNextTick = process.nextTick;

var callbackQueue = new LinkedList('callback');
var zoneQueue = new LinkedList('zone');

var scheduled = false;

function enqueueCallback(zone, receiver, fn, args) {
  callbackQueue.push(arguments);

  if (!scheduled) {
    scheduled = true;
    realNextTick(processQueues);
  }
}

function enqueueZone(zone) {
  zoneQueue.push(zone);

  if (!scheduled) {
    scheduled = true;
    realNextTick(processQueues);
  }
}

function dequeueZone(zone) {
  zoneQueue.remove(zone);
}

function processQueues() {
  var callbackEntry;
  var zoneEntry;
  var result;

  do {
    var callbackEntry;
    while (callbackEntry = callbackQueue.shift()) {
      var zone = callbackEntry[0],
          receiver = callbackEntry[1],
          fn = callbackEntry[2],
          args = callbackEntry[3];

      zone.apply(receiver, fn, args);

      zone = null;
    }

    var zoneEntry = zoneQueue.shift();
    if (zoneEntry)
      zoneEntry.__finalize__();
  } while (zoneEntry);

  scheduled = false;
}



