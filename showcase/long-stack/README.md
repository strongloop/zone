
## Long-stack showcase

This showcase demonstrates that zones can print out long stack traces,
and that zones can be named dynamically so the programmer can add
additional information that shows up in the stack trace.

In long-stack.js a couple of (nested) zones are created and some
asynchronous APIs are used (nextTick and setTimeout). Eventually a
non-existent function is called which causes an error to be thrown. Node
crashes with a long stack trace.

You can use short-stack.js if you want to be reminded what this looks
like without zones.
