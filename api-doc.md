# API reference

- [`Zone`](#zone)
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
- [`Gate`](#Gate)
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
