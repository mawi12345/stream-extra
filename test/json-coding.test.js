var WireLogger = require('./wirelogger')
  , JsonWrapper = require('../lib/buffered/json');

var wire = new WireLogger();
var encoder = new JsonWrapper(wire);
var decoder = new JsonWrapper(wire);

var object = {
	'hello': 'world'
}

console.dir(object);

encoder.write(object);

decoder.on('data', function(object){
	console.dir(object);
});