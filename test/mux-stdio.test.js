var endpoints = require('./duplexer').createCrossover()
  , MuxWrapper = require('../lib/mux');


var encoder = new MuxWrapper(endpoints[0]);
var decoder = new MuxWrapper(endpoints[1]);

process.stdin.pipe(encoder.createStream(2));

decoder.onceStream(2, function(stream){
	stream.pipe(process.stdout);
});


//decoder.createStream(2).pipe(process.stdout);

decoder.resume();
	
