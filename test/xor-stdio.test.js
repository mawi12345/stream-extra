var WireLogger = require('./wirelogger')
  , XorWrapper = require('../lib/buffered/xor');

var wire = new WireLogger();
var encoder = new XorWrapper(wire);
var decoder = new XorWrapper(wire);

decoder.pipe(process.stdout);
process.stdin.pipe(encoder);