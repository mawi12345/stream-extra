var endpoints = require('./duplexer').createCrossover()
  , Duplexer = require('./duplexer').Duplexer
  , se = require('../lib/index')
  , zlib = require('zlib');


var createStack = function(socket) {
	var mux = new se.Mux(socket);
	var json = new se.Buffered.Json(mux);
	json.mux = mux;
	return json;
}


var server = createStack(endpoints[0]);
var client = createStack(endpoints[1]);



server.write({hello: 'world'});


client.on('data', function(data){
	console.dir(data);
})

process.stdin.pipe(server.mux.createStream(2));

client.mux.onceStream(2, function(stream){
	stream.pipe(process.stdout);
});


//decoder.createStream(2).pipe(process.stdout);

//client.resume();

