var endpoints = require('./duplexer').createCrossover()
  , MuxWrapper = require('../lib/mux')
  , fs = require('fs');

var server = new MuxWrapper(endpoints[0], {idEncoding: 1});
var client = new MuxWrapper(endpoints[1], {idEncoding: 1});

var logStreams = function() {
	console.log('server', Object.keys(server.substreams), 'client', Object.keys(client.substreams));
}

var log = function(){
	console.log('##########################################');
	console.log('freeId failed '+failCounter+' times');
	console.log('server stream count', Object.keys(server.substreams).length);
	console.log('client stream count', Object.keys(server.substreams).length);
	console.log('##########################################');
}

var failCounter = 0;
var test = function(i) {
	var sid = server.freeId();
	var cid = client.freeId();
	
	if (sid == cid) {
		console.log('failed', sid, cid);
		failCounter++;
	}
	
	//server.createStream(sid).end('hello client');
	//client.createStream(cid).end('hello server');
	
	server.createStream(sid).write('hello client');
	client.createStream(cid).write('hello server');
	
	if (i > 0)
		process.nextTick(function(){
			test(i-1);
		});
	else
		log();
}
test(126);


client.resume();
server.resume();

process.on('exit', log);