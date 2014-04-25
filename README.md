# StrongLoop zone library

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
- [Overview](#overview)
  - [Disclaimer](#disclaimer)
- [Using zones](#using-zones)
  - [Creating a zone](#creating-a-zone)
    - [The curried constructor](#the-curried-constructor)
  - [Obtaining the result of a zone](#obtaining-the-result-of-a-zone)
    - [Co-style generators](#co-style-generators)
    - [Zone vs try...catch](#zone-vs-trycatch)
  - [Exiting a zone](#exiting-a-zone)
  - [Sharing resources between zones](#sharing-resources-between-zones)
  - [The rules of engagement](#the-rules-of-engagement)
  - [Zone.data](#zonedata)
  - [Bookkeeping within a zone](#bookkeeping-within-a-zone)
  - [Reference counting](#reference-counting)
  - [Cleanup procedure](#cleanup-procedure)
- [Gates](#gates)
  - [Gate example](#gate-example)
  - [Gate constructor](#gate-constructor)
  - [The curried gate constructor](#the-curried-gate-constructor)
- [API reference](#api-reference)
  - [`zone`](#zone)
  - [`new Zone(bodyFn, [callback])`](#new-zonebodyfn-callback)
  - [`zone.Zone(body)`](#zonezonebody)
  - [`Zone#run(fn, [args...])`](#zone#runfn-args)
  - [`Zone#runUnsafe(fn, [args...])`](#zone#rununsafefn-args)
  - [`Zone#runAsync(fn, [args])`](#zone#runasyncfn-args)
  - [`Zone#call(thisObj, fn, [args...])`](#zone#callthisobj-fn-args)
  - [`Zone#callUnsafe(thisObj, fn, [args...])`](#zone#callunsafethisobj-fn-args)
  - [`Zone#callAsync(thisObj, fn, arguments)`](#zone#callasyncthisobj-fn-arguments)
  - [`Zone#apply(thisObj, fn, arguments)`](#zone#applythisobj-fn-arguments)
  - [`Zone#applyUnsafe(thisObj, fn, arguments)`](#zone#applyunsafethisobj-fn-arguments)
  - [`Zone#applyAsync(thisObj, fn, arguments)`](#zone#applyasyncthisobj-fn-arguments)
  - [`Zone#schedule(fn, [args...])`](#zone#schedulefn-args)
  - [`Zone#schedule(fn, [args...])`](#zone#schedulefn-args-1)
  - [`Zone#setCallback(fn)`](#zone#setcallbackfn)
  - [`Zone#then(successCallback, [errorCallback])`](#zone#thensuccesscallback-errorcallback)
  - [`Zone#catch(errorCallback)`](#zone#catcherrorcallback)
  - [`Zone#return([value])`](#zone#returnvalue)
  - [`Zone#throw(error)`](#zone#throwerror)
  - [`Zone#complete(err, [result])`](#zone#completeerr-result)
  - [`Zone#parent`](#zone#parent)
  - [`Zone#root`](#zone#root)
  - [`Zone#data`](#zone#data)
  - [`new Gate([fn], [ancestorZone])`](#new-gatefn-ancestorzone)
  - [`Gate(fn, [ancestorZone])`](#gatefn-ancestorzone)
  - [`Gate#close()`](#gate#close)
  - [`Gate#run(fn, [args...])`](#gate#runfn-args)
  - [`Gate#runAsync(fn, [args...])`](#gate#runasyncfn-args)
  - [`Gate#call(thisObj, fn, [args...])`](#gate#callthisobj-fn-args)
  - [`Gate#callAsync(thisObj, fn, arguments)`](#gate#callasyncthisobj-fn-arguments)
  - [`Gate#apply(thisObj, fn, arguments)`](#gate#applythisobj-fn-arguments)
  - [`Gate#applyAsync(thisObj, fn, arguments)`](#gate#applyasyncthisobj-fn-arguments)
  - [`Gate#schedule(fn, [args...])`](#gate#schedulefn-args)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Overview

The StrongLoop Zone library addresses several issues in Node application development:

  * Stack traces are useless when an asynchronous function fails.

  * Asynchronous functions are hard to compose into more high-level APIs.
    Imagine a simple asynchronous API like `bar(arg1, arg2, cb)`
    where `cb` is the error-first callback function specified by the user.
    To use this correctly you must:

    - Call the callback function exactly once (not more).
    - Not throw an exception synchronously and also call the callback function.
    - Not call the callback function synchronously.

  * It is difficult to handle errors raised asynchronously.
    Typically Node will crash. If the user ignores the error, the application may leak resources.
    Zones make it easy to handle errors and avoid resource leaks.

  * Sometimes you need to associate user data to an asynchronous flow.
    There is currently no way to do this.  

### Disclaimer

This README is intended for developers interested
in the rationale and internals of the zone library. It's rough but it specifies what we're building.
It isn't particularly suited for end users at this point.

Currently many things in this document are unimplemented, or implemented differently, or buggy. 

The library is also heavily under development, so we're very open to informed criticism.

## Using zones

To use zones, add the following as the very first line of your program:

```js
require('zone');
```

The zone library monkey-patches all asynchronous APIs and exports a
global called `zone`. The `zone` global always refers to the currently
active zone. Some methods that can always be found on the 'zone' object
are actually static methods of the `Zone` class, so they don't do anything
with the currently active zone. After loading the zone library the
program has entered the 'root' zone.

### Creating a zone

There are a few different ways to create a zone. The canonical way to
create a one-off zone is:

```js
// Load the library
require('zone');

// Zone is the zone constructor.
// It is always avaiable as a property on the `zone` global.
var Zone = zone.Zone;

// MyZone is the name of this zone which shows up in stack traces.
new Zone(function MyZone() {
  // At this point the 'zone' global points at the zone instance ("MyZone")
  // that we just created.
});
```

The zone constructor function is called synchronously.
Of course zones can also be nested.

#### The curried constructor

Under some circumstances it may be desirable to create a function that is always wrapped within a zone.
The obvious way to do this:

```js
function renderTemplate(fileName, cb) {
  new Zone(function() {
    // Asynchronous unicorns and something with fileName.
    ...
  }).setCallback(cb);
}
```

To make this a little less verbose the "curried constructor" makes it possible to call `zone.Zone`
without the `new` keyword.  Doing so creates a new zone constructor that is
pre-seeded with a body. Arguments passed to the constructor are
forwarded to the body function. Example:


```js
var renderTemplate = Zone(function(fileName, cb) {
  zone.setCallback(cb);
  // Rainbow.
  ...
});
```

Now you can use this zone template as follows:

```js
renderTemplate('bar', function(err, result) {
  if (err)
    throw err;
  // Do something with the result
  ...
});
```

### Obtaining the result of a zone

Zones are like asynchronous functions. From the outside perspective,
they can return a single value or "throw" a single error. There are a
couple of ways the outside zone may obtain the result of a zone. When a
zone reports its outcome:

  * No more callbacks will run inside the zone.
  * All non-garbage-collectable resources have been cleaned up.

Zones also automatically exit when no explicit value is returned.

A way to obtain the outcome of a zone is:

```js
require('zone');
var net = require('net');

new zone.Zone(function MyZone() {
  // This runs in the context of MyZone
  net.createConnection(...);
  fs.stat(...)

  if (Math.random() < 0.5)
    throw new Error('Chaos monkey!');
  else if (Math.random() < 0.5)
    zone.return('Chaos monkey in disguise!');
  else
    ; // Wait for the zone to auto-exit.

}).setCallback(function(err, result) {
  // Here we're back in the root zone.
  // Asynchronicity is guaranteed, even if the zone returns or throws immediately.
  // By the time we get here we are sure:
  //   * the connection has been closed one way or another
  //   * fs.stat has completed
});
```

You can use a zone can as a promise too:

```js
new Zone(function MyZone() {
  // Do whatever
}).then(function(result) {
  // Runs when succesful
}).catch(function(err) {
  // Handle error
});
```

#### Co-style generators

You can also obtain the result value of a zone by yielding it.
(This is currently unimplemented)

```js
try {
  var result = yield new Zone(function MyZone() {
    // Do whatever
  });

  // If we get here it all worked.
} catch (err) {
  // The zone failed.
}
```

Instead of passing a normal function as the zone "body", you can
pass a generator constructor. This lets you use the `yield` keyword
within the zone body. Other than that, the zone behaves as if a normal
function were passed.

```js
new Zone(function* MyZone() {
  var stats = yield fs.stat('/foo/bar');
});
```

#### Zone vs try...catch

When using co-style generators, the ordinary `try..catch` statement becomes a
lot more useful, and its purpose overlaps with that of zones. But there are
also differences:

```js
try {
  var connection = net.connect('http://invalid.url'); // no yield
  var fd = yield fs.open('/file/that/exists');
  var fd2 = yield fs.open('/file/that/does/not/exist');
} catch (err) {
  // * The invalid url doesn't cause an error here because the promise isn't
  //   yield-ed.
  // * The attempt to open a nonexisting file failed and got us here.
  // * The file that was successfully opened is still open.
}
```

Contrast this to:

```js
new Zone(function*() {
  var connection = net.connect('http://invalid.url');
  var fd = yield fs.open('/file/that/exists');
  var fd2 = yield fs.open('/file/that/does/not/exist');
}).catch((err) => {
  // * Either the failed connection attempt, or the nonexisting file
  //  (whichever happened first) made the zone fail.
  // * The zone has automatically closed the file that was succesfully
  //   opened before invoking the catch handler.
});
```

### Exiting a zone

There are a few ways to explicitly exit a zone:

* `zone.return(value)` sets the return value of the zone and starts cleanup.
* `zone.throw(error)` sets the zone to failed state and starts cleanup. `zone.throw` itself does not throw, so statements after it will run.
* `throw error` uses normal exception handling. If the exception is not caught before it reaches the binding layer, the active zone is set to failed state and starts cleanup.
* `zone.complete(err, value)` is a zone-bound function that may be passed to subordinates to let them exit the zone.

A rather pointless example:

```js
new Zone(function StatZone() {
  fs.stat('/some/file', function(err, result) {
    if (err)
      throw err;
    else
      zone.return(result);
  });
});
```

This is equivalent to:

```js
new Zone(function StatZone() {
  fs.stat('/some/file', zone.complete);
});
```

### Sharing resources between zones

Within a zone you may use resources that are "owned" by ancestor zones. So this is okay:

```js
var server = http.createServer().listen(1234);
server.listen(1234);

new Zone(function ServerZone() {
  // Yes, allowed.
  server.on('connection', function(req, res) { ... });

  // Totally okay
  process.stdout.write('hello!');
});
```

However, using resources owned by child zones is not allowed:

```js
var server;

new Zone(function SomeZone() {
 server = http.createServer().listen(1234);
});

// NOT OKAY!
server.on('connection', function() { ... });
```

NOTE: Currently zones don't always enforce these rules, but you're not supposed to do this.
It would also be dumb, since the server will disappear when `SomeZone()` exits itself!

### The rules of engagement

It is okay for a zone to temporarily enter an ancestor zone. It is not
allowed to enter child zones, siblings, etc. The rationale behind this is
that when a zone is alive its parent must also be alive. Other zones
may exit unless they are aware that code will run inside them.

```js
new Zone(function OuterZone() {
  var childZone = new Zone(function ChildZone() {
    ...
  });

  // Fine.
  zone.parent.run(function() {
    console.log('Hello from the root zone!');
  });

  // NOT ALLOWED
  childZone.run(function() {
    console.log('Weird. This isn't supposed to work!');
  });
});
```

To run code in a child zone, use a [Gate](#gates).

### Zone.data

zone.data is a magical property that that associates arbitraty data with a zone.
In a way you can think of it as the 'scope' of a zone. Properties that are not explicitly
defined within the scope of a zone are inherited from the parent zone.

  * In the root zone, `zone.data` equals the global object.
  * In any other zone, `zone.data` starts off as an empty object with the parent zone's `data` property as it's prototype.
  * In other words, `zone.data.__proto__ === zone.parent.data`.
  
### Bookkeeping within a zone

Resources and asynchronous operations register themselves with the parent zone. There are two reasons for this:

  * The zone needs to keep a reference count of callbacks that will or may happen in the future.
  * The asynchronous operation or resource can register a destructor that is called before the zone exits.

### Reference counting

The reference counting scheme is similar to the one libuv uses. However
it is more complex because events don't necessarily originate from the
"root". Consider the following case:

```js
new Zone(function OuterZone() {
  var emitter = new EventEmitter();

  new Zone(function InnerZone() {
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
new Zone(function() {
var emitter = new EventEmitter();

new Zone(function() {

  new Zone(function() {
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
new Zone(function OuterZone() {
  var emitter = new EventEmitter();

  new Zone(function InnerZone() {
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

### Cleanup procedure

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
net.Socket     | stop receiving, graceful close           | abortive close
timer.Interval | ?                                        | ?
Zone           | set state to 'success' and start cleanup | set state to 'failed' and start cleanup
Event listener | remove listener                          | remove listener, call the 'error' handler registered by the zone, or throw if there is none

## Gates

As explained earlier, it is not allowed to arbitrarily enter a zone from
another zone; the only exception being that you can always enter an ancestor zones.

The reason is that the zone library can't predict if and how often you are
going to run a function inside a particular zone.

For the cases where you need to do this anyway, use a _gate_. By creating a gate you're allowing another
zone (and all of its descendant zones) to enter the current zone in the future. This means that the
gate also prevents the zone from exiting.

**NOTE: The Gate API isn't final.**

### Gate example
The canonical way to create a gate is, for example:

```
require('zone');

new Zone(function OuterZone() {
  var theGate;

  new Zone(function InnerZone() {
    // Construct a Gate that allows out parent zone (OuterZone) to enter
    // the current zone (InnerZone).
    theGate = new Gate(zone.parent);
  });

  theGate.schedule(function() {
    // This runs inside the
    console.log('Hello from InnerZone');
  });

  theGate.close(); // Close the gate. InnerZone can now exit.
});
```

### Gate constructor

The `Gate([fn], [gate])` constructor takes two optional arguments.

  * `fn` is a function that is synchronously run inside the ancestor zone.
    Within this function, `this` refers to the gate object.
  * `gate` specifies the the ancestor zone that is allowed to use the gate.
    If this parameter is omitted the root zone is assumed, which means that all
    zones are allowed to use this gate.

### The curried gate constructor

Just like the `Zone()` function, you can use the `Gate()` function as a curried constructor.
In the following example, assume that `noZoneSetTimeout(callback, msec)` is a function that doesn't
support zones, so the callback is always run in the root zone.
Now we want to wrap it and make it run the callback in the zone that called `setTimeout()`.

```js
global.setTimeout = Gate(function(callback, msec) {
  // When we get here, a gate from the root zone to the caller zone has been
  // opened.
  var self = this;

  noZoneSetTimeout(function() {
    // Call the user callback through the gate so it ends up in the proper
    // zone.
    self.schedule(callback);

    // Close the gate, so the caller zone may now exit.
    self.close();
  }, msec);
});
```

In the above example, the `global.setTimeOut` function actually
returns the gate created, because it's really a constructor.

TODO: do we need to do something about that?

## API reference

### `zone`

This global variable always contains a reference to the active zone.

### `new Zone(bodyFn, [callback])`

Constructs a new zone.

* `bodyFn`: the function to be run sycnhronously inside the new zone.
* `callback(err, result)` and optional error-first callback that will be run
  inside the parent zone after the zone has exited.

### `zone.Zone(body)`

Returns a curried zone constructor.

### `Zone#run(fn, [args...])`
### `Zone#runUnsafe(fn, [args...])`
### `Zone#runAsync(fn, [args])`
### `Zone#call(thisObj, fn, [args...])`
### `Zone#callUnsafe(thisObj, fn, [args...])`
### `Zone#callAsync(thisObj, fn, arguments)`
### `Zone#apply(thisObj, fn, arguments)`
### `Zone#applyUnsafe(thisObj, fn, arguments)`
### `Zone#applyAsync(thisObj, fn, arguments)`
### `Zone#schedule(fn, [args...])`

Synchronously call a function inside a zone. This function throws if the target
zone is not an ancestor of the target zone.

These functions all do similar things.

  * `run`, `call`, and `apply` synchronously run the function in the target zone.
    These functions never throw; if the called function throws the exception is handled by the target zone.
    The function should not return a value.

  * `runUnsafe`, `callUnsafe`, and `applyUnsafe` and `applyUnsafe` also synchronously run the function in the target zone.
    If the function throws, the error isn't caught and is handled by the caller zone.
    The return value of these functions is whatever the invoked function returns.

  * `runAsync`, `callAsync`, and `applyAsync` are used to schedule a function to be run asynchronously in the target zone.
    These functions never throw; if the called function throws the exception is handled by the target zone.
    The function should not return a value.

  * `run`, `runUnsafe` and `runAsync` invoke the specified function with `this` bound to the target zone.
    Arguments beyond the first one are passed to the called function.

  * `call`, `callUnsafe` and `callAsync` let you specify the value that `this` is bound to.
    Arguments beyond the first one are passed to the called function.

  * `apply`, `applyUnsafe` and `applyAsync` let you specify the value for `this` in the function invoked.
    The third arguments should be an array or array-like object which contains a list of arguments for that function.

  * `schedule` is an alias for `runAsync`.

### `Zone#schedule(fn, [args...])`

This method is equivalent to `Zone#runAsync`.

### `Zone#setCallback(fn)`

Sets the exit callback for a zone.

  * `fn`: the error-first `function(err, result)` callback that is called after the zone has exited.

This function throws if a callback has already been specified.
If the value of `fn` equals `null` or `undefined`, the function is a no-op.

### `Zone#then(successCallback, [errorCallback])`

  * `successCallback`: a `function(result)` callback that is called with the zone result value as the argument (or `undefined` when the zone didn't return a value) after the zone has exited successfully.
  * `errorCallback`: a `function(err)` callback that is called with the first uncaught error that occured within the zone as the argument, after the zone has exited.

If you specify a success callback, but a success or error-first callback
has already been registered, this function throws. If you specify an
error callback, but an error or error-first callback has already been
registered, this function throws. You may specify `null` or `undefined`
for either function, in which case the particular callback is ignored.

### `Zone#catch(errorCallback)`

Like `Zone#then`, but only registers the error callback.

### `Zone#return([value])`

Tell the zone to exit, optionally specifying a return value.
If the `value` parameter is `undefined` no return value will be set, but the zone will start it's cleanup procedure.
If a return value for the zone has already been set, this function throws.

### `Zone#throw(error)`

Set the zone to a failed state and directs it to exit.
This function returns normally.

### `Zone#complete(err, [result])`

Sets the zone to either failed or succeeded state.
Optionally sets the result value.
This function is always bound to the zone it completes.

### `Zone#parent`

A reference to the parent zone.

### `Zone#root`

A reference to the root zone.

### `Zone#data`

Every zone instance gets an unique `data` property which initially is
an empty object. The prototype of this object is the `.data` property of
the parent zone. In the global zone, `data` property refers to the
global object.

### `new Gate([fn], [ancestorZone])`

Opens a gate that allows `ancestorZone` to make callbacks to the current zone.
If a function is specified, the ancestor zone is temporarily entered, and `fn` is
run inside it with `this` bound to the newly constructed gate. If the `fn` function
throws, no Gate is constructed and the error is rethrown in the calling zone.

### `Gate(fn, [ancestorZone])`

Returns a curried Gate constructor.

### `Gate#close()`

Closes the gate. After this the zone that created the Gate can exit again.
No calls to `run`, `schedule` etc are allowed after closing a gate.

### `Gate#run(fn, [args...])`
### `Gate#runAsync(fn, [args...])`
### `Gate#call(thisObj, fn, [args...])`
### `Gate#callAsync(thisObj, fn, arguments)`
### `Gate#apply(thisObj, fn, arguments)`
### `Gate#applyAsync(thisObj, fn, arguments)`
### `Gate#schedule(fn, [args...])`

Use the gate to execute a function in the context of the creator zone.
See the equivalent Zone class methods.

Gates don't offer the `...Unsafe` class of invocation methods.
