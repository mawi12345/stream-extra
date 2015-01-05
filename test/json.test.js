var se = require('../lib/index')
  , WireLogger = require('./wirelogger')
  , os = require('os');

var wire = new WireLogger({name: 'zipped'});
var zippedEncoder = se.json(wire);
var zippedDecoder = se.json(wire);

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

var wireSimple = new WireLogger({name: 'simple'});
var simpleEncoder = new se.JsonWrapper(new se.BufferedWrapper(wireSimple));
var simpleDecoder = new se.JsonWrapper(new se.BufferedWrapper(wireSimple));

simpleEncoder.write(osStats());

simpleDecoder.on('data', function(object){
	console.dir(object);
});