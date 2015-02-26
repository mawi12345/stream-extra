var se = require('../lib/index')
  , endpoints = require('./duplexer').createCrossover()
  , os = require('os');

var zippedEncoder = se.json(endpoints[0]);
var zippedDecoder = se.json(endpoints[1]);

var osStats = function() {
	return {
		'hostname': os.hostname(),
		'type': os.type(),
		'platform' : os.platform(),
		'arch': os.arch(),
		'release': os.release(),
		'uptime': os.uptime(),
		'loadavg': os.loadavg(),
		'totalmem': os.totalmem(),
		'freemem': os.freemem(),
		'cpus': os.cpus()
	};
}

zippedEncoder.write(osStats());

zippedDecoder.on('data', function(object){
	console.dir(object);
});

var simpleEndpoints = require('./duplexer').createCrossover({name: 'S>'}, {name: 'S<'});

var simpleEncoder = new se.Buffered.Json(new se.Buffered(simpleEndpoints[0]));
var simpleDecoder = new se.Buffered.Json(new se.Buffered(simpleEndpoints[1]));

simpleEncoder.write(osStats());

simpleDecoder.on('data', function(object){
	console.dir(object);
});