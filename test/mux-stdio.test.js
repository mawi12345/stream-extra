var endpoints = require('./duplexer').createCrossover()
  , MuxWrapper = require('../lib/mux');

var server = new MuxWrapper(endpoints[0]);
var client = new MuxWrapper(endpoints[1]);

process.stdin.pipe(server.createStream(2));

client.onceStream(2, function(stream){
	stream.pipe(process.stdout);
});


//client.createStream(2).pipe(process.stdout);

client.resume();
	
