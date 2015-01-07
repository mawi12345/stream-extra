var endpoints = require('./duplexer').createCrossover()
  , BufferedWrapper = require('../lib/buffered');

var encoder = new BufferedWrapper(endpoints[0]);
var decoder = new BufferedWrapper(endpoints[1]);

decoder.pipe(process.stdout);
process.stdin.pipe(encoder);