var WireLogger = require('./wirelogger')
  , BufferedWrapper = require('../lib/buffered');

var wire = new WireLogger();
var encoder = new BufferedWrapper(wire);
var decoder = new BufferedWrapper(wire);

decoder.pipe(process.stdout);
process.stdin.pipe(encoder);