var endpoints = require('./duplexer').createCrossover()
  , CipherWrapper = require('../lib/cipher')
  , crypto = require('crypto');

crypto.randomBytes(24, function(ex, buf) {
	var options = {
		key: buf,
		algorithm: 'AES-192-CBC',
		iv: buf.slice(0,16)
	}
	
	var encoder = new CipherWrapper(endpoints[0], options);
	var decoder = new CipherWrapper(endpoints[1], options);
	
	decoder.pipe(process.stdout);
	process.stdin.pipe(encoder);
	
	process.on('SIGINT', function() {
		process.stdin.unpipe(encoder);
		encoder.end();
	});
});