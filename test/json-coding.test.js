var endpoints = require('./duplexer').createCrossover()
  , JsonWrapper = require('../lib/buffered/json');

var encoder = new JsonWrapper(endpoints[0]);
var decoder = new JsonWrapper(endpoints[1]);

var object = {
	'hello': 'world'
}

console.dir(object);

encoder.write(object);

decoder.on('data', function(object){
	console.dir(object);
});