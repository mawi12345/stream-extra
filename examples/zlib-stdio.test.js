var endpoints = require('./duplexer').createCrossover()
  , ZlibWrapper = require('../lib/buffered/zlib');

var encoder = new ZlibWrapper(endpoints[0]);
var decoder = new ZlibWrapper(endpoints[1]);

decoder.pipe(process.stdout);
process.stdin.pipe(encoder);