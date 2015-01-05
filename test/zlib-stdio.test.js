var WireLogger = require('./wirelogger')
  , ZlibWrapper = require('../lib/buffered/zlib');

var wire = new WireLogger();
var encoder = new ZlibWrapper(wire);
var decoder = new ZlibWrapper(wire);

decoder.pipe(process.stdout);
process.stdin.pipe(encoder);