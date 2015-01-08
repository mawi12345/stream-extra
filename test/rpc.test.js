var endpoints = require('./duplexer').createCrossover() //({encodig: 'utf8'}, {encodig: 'utf8'})
  , se = require('../lib/index')
  , Q = require('q');

var createStack = function(socket, handler) {
	var mux = new se.Mux(socket);
	var json = new se.Buffered.Json(mux);
	var rpc = new se.Buffered.Json.Rpc(json, handler);
	return rpc;
}


var handler = {
	hello: function(params) {
		var deferred = Q.defer();
		deferred.resolve('hello '+params.name);
		return deferred.promise;
	}
}


var remoteServer = createStack(endpoints[0], handler);
var remoteClient = createStack(endpoints[1], handler);


remoteServer.call('hello', {name: 'server'})
.then(function(data){
	console.log('client received '+data);
}).fail(function(error){
	console.error('client received '+error.message);
});


remoteServer.call('hello2', {name: 'lol'})
.then(function(data){
	console.log('client received '+data);
}).fail(function(error){
	console.error('client received '+error.message);
});


remoteClient.call('hello', {name: 'client'})
.then(function(data){
	console.log('server received '+data);
}).fail(function(error){
	console.error('remoteClient received '+error.message);
});