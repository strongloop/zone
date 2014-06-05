# StrongLoop zone library

## Overview

The StrongLoop zone library:

  * Enables more effective debugging by providing better stack traces for asynchronous functions.
  * Makes it easier to write and understand asynchronous functions for Node applications.
  * Makes it easier to handle errors raised asynchronously and avoid resulting resource leaks.
  * Enables you to associate user data with asynchronous control flow

**IMPORTANT**: You must have Node 0.11 to use zones.


## Implementation status

* The zone library and documentation are still under development: there are bugs, missing features, and
  limited documentation.

* The Gate API will change.

* The zone library dynamically modifies Node's asynchronous APIs at runtime.
  As detailed below, some of the modules have not yet been completed, and thus you cannot use them with zones.
  Therefore, you cannot yet use the following modules and functions with zones:
  - cluster
  - crypto: `pbkdf2`, `randomBytes`, `pseudoRandomBytes`
  - fs: `fs.watch`, `fs.watchFile`, `fs.FSWatcher`
  - process object: `process.on('SIGHUP')` and other signals.
  - tls / https
  - udp
  - zlib

## Using zones

To use zones, add the following as the very first line of your program:

```js
require('zone').enable();
```

The zone library exports a global variable, `zone`.
The `zone` global variable always refers to the currently active zone.
Some methods that can always be found on the 'zone' object
are actually static methods of the `Zone` class, so they don't do anything
with the currently active zone.

After loading the zone library the program has entered the 'root' zone.

### Creating a zone

There are a few different ways to create a zone. The canonical way to
create a one-off zone is:

```js
// Load the library
require('zone').enable();

// MyZone is the name of this zone which shows up in stack traces.
zone.create(function MyZone() {
  // At this point the 'zone' global points at the zone instance ("MyZone")
  // that we just created.
});
```

The zone constructor function is called synchronously.


#### Defining zone functions

Under some circumstances it may be desirable to create a function that is always wrapped within a zone.
The obvious way to do this:

```js
function renderTemplate(fileName, cb) {
  zone.create(function() {
    // Actual work here
    ...
  }).setCallback(cb);
}
```

To make this a little less verbose there is the 'zone.define()' API.
With it you can wrap a function such that when it's called a zone is created.
Example:

```js
var renderTemplate = zone.define(function(fileName, cb) {
  zone.setCallback(cb);
  // Actual work here
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
require('zone').enable();
var net = require('net');

zone.create(function MyZone() {
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

You can also use the `then` and `catch` methods, as if it were a promise.
Note that unlike promises you can't currently chain calls callbacks.

```js
zone.create(function MyZone() {
  // Do whatever
}).then(function(result) {
  // Runs when succesful
}).catch(function(err) {
  // Handle error
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
zone.create(function StatZone() {
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
zone.create(function StatZone() {
  fs.stat('/some/file', zone.complete);
});
```

### Sharing resources between zones

Within a zone you may use resources that are "owned" by ancestor zones. So this is okay:

```js
var server = http.createServer().listen(1234);
server.listen(1234);

zone.create(function ServerZone() {
  // Yes, allowed.
  server.on('connection', function(req, res) { ... });

  // Totally okay
  process.stdout.write('hello!');
});
```

However, using resources owned by child zones is not allowed:

```js
var server;

zone.create(function SomeZone() {
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
zone.create(function OuterZone() {
  var childZone = zone.create(function ChildZone() {
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

zone.data is a magical property that that associates arbitrary data with a zone.
In a way you can think of it as the 'scope' of a zone. Properties that are not explicitly
defined within the scope of a zone are inherited from the parent zone.

  * In the root zone, `zone.data` equals the global object.
  * In any other zone, `zone.data` starts off as an empty object with the parent zone's `data` property as it's prototype.
  * In other words, `zone.data.__proto__ === zone.parent.data`.


## Gates

**NOTE: The Gate API will be replaced by something that's easier to use!**

As explained earlier, it is not allowed to arbitrarily enter a zone from
another zone; the only exception being that you can always enter an ancestor zones.

The reason is that the zone library can't predict if and how often you are
going to run a function inside a particular zone.

For the cases where you need to do this anyway, use a _gate_. By creating a gate you're allowing another
zone (and all of its descendant zones) to enter the current zone in the future. This means that the
gate also prevents the zone from exiting.

### Gate example
The canonical way to create a gate is, for example:

```
require('zone').enable();

zone.create(function OuterZone() {
  var theGate;

  zone.create(function InnerZone() {
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

You can use the `Gate()` function as a curried constructor.
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

## Other documentation
  * [API Reference](api-doc.md)
  * [Internals](internals.md)
