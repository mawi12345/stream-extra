var endpoints = require('./duplexer').createCrossover()
  , XorWrapper = require('../lib/buffered/xor');

var encoder = new XorWrapper(endpoints[0]);
var decoder = new XorWrapper(endpoints[1]);

decoder.pipe(process.stdout);
process.stdin.pipe(encoder);