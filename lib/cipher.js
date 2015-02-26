var util = require('util')
  , crypto = require('crypto')
  , Duplex = require('stream').Duplex;

util.inherits(CipherWrapper, Duplex);

function CipherWrapper(source, options) {
	if (!(this instanceof CipherWrapper))
	    return new CipherWrapper(source, options);
	
	Duplex.call(this, options);
	source.pause();
	options = options || {};
	this._source = source;
	if (!options.algorithm) throw new Error('option algorithm is required');
	if (!options.key) throw new Error('option key is required');
	
	if (options.iv) {
		this._cipher = crypto.createCipheriv(options.algorithm, options.key, options.iv);
		this._decipher = crypto.createDecipheriv(options.algorithm, options.key, options.iv);
	} else {
		this._cipher = crypto.createCipher(options.algorithm, options.key);
		this._decipher = crypto.createDecipher(options.algorithm, options.key);
	}
    
	this._source.pipe(this._decipher);
	this._cipher.pipe(this._source);
	
	var self = this;
	// Every time there's data, we push it into the internal buffer.
	this._decipher.on('data', function(chunk) {
        if (!self.push(chunk)) {
        	self._source.pause();
        }
	});
	// When the source ends, we push the EOF-signalling `null` chunk
	this._source.on('end', function() {
		console.log('r end');
    	self.push(null);
    });
	this._decipher.on('end', function() {
		console.log('de end');
    	self.push(null);
    });
    this.once('finish', function() {
    	console.log('this end');
    	this._cipher.end();
    	this._source.end();
	});
}

CipherWrapper.prototype._read = function(size) {
	this._source.resume();
};

CipherWrapper.prototype._write = function(chunk, encoding, done) {
	this._cipher.write(chunk, encoding, done);
}

module.exports = CipherWrapper;