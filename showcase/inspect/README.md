
## Inspect showcase

This showcase demonstrates what the _inspect_ tool does.

### What's in here

The directory contains two executable node programs.

  * `demo.js` spins up a TCP server. After that it creates a bunch of
    clients that send data to the server on an interval basis.
  * `inspect.js` delegates to the actual inspect tool which lives in
    the `/bin` directory.

### Running the showcase

  * Run `demo.js` it won't exit by itself.
  * In another terminal, run `inspect.js` or `/bin/inspect.js` to see
    a snapshot of the asynchronous action going on in demo.js.

### Purpose of the inspect tool

The inspect tool outputs a snapshot of all the asynchronous action
going on inside all node processes using zones. It also displays
resources (like sockets and file descriptors) that by themselves do not
represent future events, but are relevant to zones because these
resources are automatically cleaned up when the zone returns or throws.

The output looks like a tree, because zones act as containers for
asynchronous I/O and related resources.

Entries marked with a `+` are active sources of events that are running
inside the zone. Entries not marked with a plus sign are passive
resources that don't produce callbacks, but that are cleanup up when a
zone returns or throws.


### Output

The output should look similar to this:

```txt
(3628) node D:\zone\showcase\inspect\demo.js
+Root #1 [14 children, 0 refs]
   TTY handle #41 (fd: 2)
   TTY handle #40 (fd: 1)
  +DebugServerZone #2 [6 children, 4 refs]
     Pipe server #3
    +Listen #4
     Pipe handle #81037
    +Read #81038
    +Stream request #81039
    +nextTick #81040
  +ServerZone #6 [22 children, 11 refs]
     TCP server #7 (:::3000)
    +Listen #8
     TCP handle #47 (::ffff:127.0.0.1:3000 <=> ::ffff:127.0.0.1:49872)
    +Read #48
     TCP handle #53 (::ffff:127.0.0.1:3000 <=> ::ffff:127.0.0.1:49873)
    +Read #54
     TCP handle #59 (::ffff:127.0.0.1:3000 <=> ::ffff:127.0.0.1:49874)
    +Read #60
     TCP handle #65 (::ffff:127.0.0.1:3000 <=> ::ffff:127.0.0.1:49875)
    +Read #66
     TCP handle #71 (::ffff:127.0.0.1:3000 <=> ::ffff:127.0.0.1:49876)
    +Read #72
     TCP handle #77 (::ffff:127.0.0.1:3000 <=> ::ffff:127.0.0.1:49877)
    +Read #78
     TCP handle #83 (::ffff:127.0.0.1:3000 <=> ::ffff:127.0.0.1:49878)
    +Read #84
     TCP handle #89 (::ffff:127.0.0.1:3000 <=> ::ffff:127.0.0.1:49879)
    +Read #90
     TCP handle #95 (::ffff:127.0.0.1:3000 <=> ::ffff:127.0.0.1:49880)
    +Read #96
     TCP handle #101 (::ffff:127.0.0.1:3000 <=> ::ffff:127.0.0.1:49881)
    +Read #102
  +ConnectionZone #10 [3 children, 2 refs]
     TCP handle #11 (127.0.0.1:49872 <=> 127.0.0.1:3000)
    +IntervalZone #44 [1 children, 1 refs]
      +setInterval #45
    +Read #46
  +ConnectionZone #13 [3 children, 2 refs]
     TCP handle #14 (127.0.0.1:49873 <=> 127.0.0.1:3000)
    +IntervalZone #50 [1 children, 1 refs]
      +setInterval #51
    +Read #52
  +ConnectionZone #16 [3 children, 2 refs]
     TCP handle #17 (127.0.0.1:49874 <=> 127.0.0.1:3000)
    +IntervalZone #56 [1 children, 1 refs]
      +setInterval #57
    +Read #58
  +ConnectionZone #19 [3 children, 2 refs]
     TCP handle #20 (127.0.0.1:49875 <=> 127.0.0.1:3000)
    +IntervalZone #62 [1 children, 1 refs]
      +setInterval #63
    +Read #64
  +ConnectionZone #22 [3 children, 2 refs]
     TCP handle #23 (127.0.0.1:49876 <=> 127.0.0.1:3000)
    +IntervalZone #68 [1 children, 1 refs]
      +setInterval #69
    +Read #70
  +ConnectionZone #25 [3 children, 2 refs]
     TCP handle #26 (127.0.0.1:49877 <=> 127.0.0.1:3000)
    +IntervalZone #74 [1 children, 1 refs]
      +setInterval #75
    +Read #76
  +ConnectionZone #28 [3 children, 2 refs]
     TCP handle #29 (127.0.0.1:49878 <=> 127.0.0.1:3000)
    +IntervalZone #80 [1 children, 1 refs]
      +setInterval #81
    +Read #82
  +ConnectionZone #31 [3 children, 2 refs]
     TCP handle #32 (127.0.0.1:49879 <=> 127.0.0.1:3000)
    +IntervalZone #86 [1 children, 1 refs]
      +setInterval #87
    +Read #88
  +ConnectionZone #34 [3 children, 2 refs]
     TCP handle #35 (127.0.0.1:49880 <=> 127.0.0.1:3000)
    +IntervalZone #92 [1 children, 1 refs]
      +setInterval #93
    +Read #94
  +ConnectionZone #37 [3 children, 2 refs]
     TCP handle #38 (127.0.0.1:49881 <=> 127.0.0.1:3000)
    +IntervalZone #98 [1 children, 1 refs]
      +setInterval #99
    +Read #100
```
