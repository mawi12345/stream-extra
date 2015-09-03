var endpoints = require('./duplexer').createCrossover()
  , MuxWrapper = require('../lib/mux')
  , fs = require('fs');

var server = new MuxWrapper(endpoints[0]);
var client = new MuxWrapper(endpoints[1]);

var logStreams = function() {
	console.log('server', Object.keys(server.substreams), 'client', Object.keys(client.substreams));
}

logStreams();

var download = server.createStream(2);
fs.createReadStream(__filename).pipe(download);

logStreams();

client.onceStream(2, function(stream){
	console.log('server stream 2');
	//stream.pipe(process.stdout);
	stream.on('end', function() {
		console.log('start upload');
		var upload = client.createStream(3);
		logStreams();
		fs.createReadStream(__filename).pipe(upload);
	});
	
	stream.on('data', function(chunk){
		console.log('client got '+chunk.length+' bytes');
	});
	
	logStreams();
	
	//process.nextTick(function(){
		//console.dir(client);
	//});
});


//client.createStream(2).pipe(process.stdout);

server.onceStream(3, function(stream){
	console.log('client stream 3');
	
	stream.on('data', function(chunk){
		console.log('server got '+chunk.length+' bytes')
	});
	
	stream.on('end', function() {
		
		logStreams();
		process.nextTick(logStreams, 500);
	});
	
	logStreams();
});

client.resume();
server.resume();