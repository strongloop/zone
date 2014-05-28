> NOTE: These sections are moved from the [README](README.md) since they seem to be primarily about internal implementation.  If we find that there is information here that is of interest to zone users, then we'll move it back to the README.



  - [Bookkeeping within a zone](#bookkeeping-within-a-zone)
  - [Reference counting](#reference-counting)
  - [Cleanup procedure](#cleanup-procedure)
    
## Bookkeeping within a zone

Resources and asynchronous operations register themselves with the parent zone. There are two reasons for this:

  * The zone needs to keep a reference count of callbacks that will or may happen in the future.
  * The asynchronous operation or resource can register a destructor that is called before the zone exits.

## Reference counting

The reference counting scheme is similar to the one libuv uses. However
it is more complex because events don't necessarily originate from the
"root". Consider the following case:

```js
zone.create(function OuterZone() {
  var emitter = new EventEmitter();

  zone.create(function InnerZone() {
    emitter.on('some-event', function() {
      zone.return(42);
    });
  })
});
```

With a naive reference counting scheme this would cause a deadlock. The
"OuterZone" doesn't exit because it's waiting for the "InnerZone" to
exit. However the "InnerZone" doesn't exit because it's expecting an
event that originates from "OuterZone"

Therefore we use a slightly more complicated reference counting scheme.
Every zone has a reference count (number) equal to number of events
*originating from one of its ancestors*, that it *or any of its child
zones* are waiting for. To demonstrate:

```js
zone.create(function() {
var emitter = new EventEmitter();

zone.create(function() {

  zone.create(function() {
    emitter.on('bar', function() {...});
    // Reference count == 1:
    // * the 'bar' event originates from the grandparent
  });

  fs.stat('/some/file', function() {...});

  // Reference count == 2
  // * the 'bar' event originates from the parent, and a child is expecting
  //   it.
  // * the 'stat' completion callback originates from the root zone.
});

// Reference count == 1
// * the 'stat' completion callback originates from the root zone
//   (our parent) and a child is waiting for it.
});
```

This avoids the deadlock:

```js
zone.create(function OuterZone() {
  var emitter = new EventEmitter();

  zone.create(function InnerZone() {
    emitter.on('some-event', function() {
      zone.return(42);
    });

    // Reference count == 1:
    // * the 'some-event' event originates from the parent zone.
  })

  // Reference count == 0. This zone immediately starts the cleanup
  // procedure.
});
```

## Cleanup procedure

(This is currently not implemented correctly!)

The cleanup procedure runs under either these conditions:

  * The zone is in completed state.
  * The zone is in failed state
  * The reference count is zero.

The cleanup procedure itself looks like this:

  * Entities registered to a zone (sockets, asynchronous operations, child
    zones) have their .signal(error) method called in reverse creation
    (LIFO) order.
  * Initially the zone just calls .signal(error) on the last
    entity registered to it.
  * When that entity de-registers itself, the
    next-last entity is signaled.
  * If the zone is in failed state, the error
    is passed to the .signal() method.
  * If the zone initially was in succesful state but a later error causes it
    to switch to failed state, the last entity is signaled again with the
    new error.
  * The Zone class implements a default signal() that forwards the signal to
  * it's children.

TODO: rename .signal() to something else?

It is up to the entity itself to respond appropriately to a signal. Some examples:

Entity         | Success response                         | Failure response
-------------- | ---------------------------------------- | ---------------------------------------
fs.write       | await completion                         | cancel and report CancellationError
net.Socket     | graceful close                           | stop receiving, abortive close
timer.Timeout  | do nothing                               | cancel the timer (unless the timeout was 0)
timer.Interval | do nothing                               | cancel the interval timer
Zone           | set state to 'success' and start cleanup | set state to 'failed' and start cleanup
Event listener | remove listener                          | remove listener, call the 'error' handler registered by the zone, or throw if there is none
