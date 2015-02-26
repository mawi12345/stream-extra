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
	},
	
	mkprogress: function(params) {
		var deferred = Q.defer();
		params = params || {};
		var count = params.count || 10;
		var timeout = params.timeout || 500;
		
		var i = 0;
		var doTask = function() {
			deferred.notify('task '+i+' done');
			i++
			if (i < count) {
				setTimeout(doTask, timeout);
			} else {
				deferred.resolve('all tasks done');
			}
		}
		setTimeout(doTask, timeout);
		
		return deferred.promise;
	}
}


var remoteServer = createStack(endpoints[0], handler);
var remoteClient = createStack(endpoints[1], handler);


remoteServer.call('hello', {name: 'server'})
.then(function(data){
	console.log('client received server.hello() result: '+data);
}).fail(function(error){
	console.error('client received server.hello() error: '+error.message);
});


remoteServer.call('hello2', {name: 'lol'})
.then(function(data){
	console.log('client received server.hello2() result: '+data);
}).fail(function(error){
	console.error('client received server.hello2() error: '+error.message);
});


remoteClient.call('hello', {name: 'client'})
.then(function(data){
	console.log('server received clinet.hello() result: '+data);
}).fail(function(error){
	console.error('remoteClient received clinet.hello() error: '+error.message);
});

remoteClient.call('mkprogress', {count: 8})
.then(function (result) {
    // Success 
	console.log('server received clinet.mkprogress() result: '+result);
}, function (err) {
    // There was an error
	console.log('server received clinet.mkprogress() error: '+err.message);
}, function (progress) {
    // We get notified of the progress as it is executed
	console.log('server received clinet.mkprogress() progress: '+progress);
});