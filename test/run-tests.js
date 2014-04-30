
// Tests to run, and directories that have contain tests to be run.
// Grow this list as necessary.
var TESTS = ['simple'];

// Recurse into directories that match this filter.
var DIR_FILTER = /^[^.].*$/;

// Only test the files that match this filter.
var FILE_FILTER = /^[^.].*\.*js$/;


var cwd = process.cwd();
var dirname = require('path').dirname;
var fs = require('fs');
var relative = require('path').relative;
var resolve = require('path').resolve;
var spawnSync = require('child_process').spawnSync;

var successes = 0;
var failures = 0;

testAll();

console.error('%d failed, %d passed', failures, successes);


function testAll() {
  // Test all the things specified in the TESTS list.
  for (var i = 0; i < TESTS.length; i++) {
    var name = TESTS[i];
    testAny(__dirname, name);
  }
}


function testAny(dir, name) {
  // Find the full path of the file if necessary.
  var path = resolve(dir, name);

  if (FILE_FILTER.test(name) && fs.statSync(path).isFile())
    testFile(path);
  else if (DIR_FILTER.test(name) && fs.statSync(path).isDirectory())
    testDir(path);
}


function testDir(path) {
  // Read all the files in this directory.
  var names = fs.readdirSync(path);

  // Test all files that match the either filter.
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    testAny(path, name);
  }
}


function testFile(path) {
  var name = relative(cwd, path);

  var node = process.execPath;
  var argv = process.execArgv.concat([path]);
  var options = { cwd: dirname(path),
                  encoding: 'utf8' };

  var result = spawnSync(node, argv, options);

  if (result.status === 0 && !result.signal) {
    console.error('pass: %s',
                  name);
    successes++;
  } else {
    var output = (result.stderr || result.stdout);
    output = output.replace(/^[\s\r\n]*[\r\n]/, '');
    output = output.replace(/[\s\r\n]*$/, '\n');

    console.error('\x1b[30;41mfail: %s\x1b[0m\n' +
                  '\x1b[31m%s\x1b[0m',
                  name,
                  output);
    failures++;
  }
}
