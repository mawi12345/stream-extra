// warning useless! use an tls socket!

var util = require('util')
  , Duplex = require('stream').Duplex;

util.inherits(XorWrapper, Duplex);

function xor(data, key) {
	if (!Buffer.isBuffer(data)) data = new Buffer(data);
	if (!Buffer.isBuffer(key)) key = new Buffer(key);
	
	var encoded = new Buffer(data.length);
	for (var i = 0; i < data.length; i++) {
		encoded[i] = data[i] ^ key[i % key.length];
	}
	return encoded;
}

function XorWrapper(source, options) {
	if (!(this instanceof XorWrapper))
	    return new XorWrapper(source, options);
	
	Duplex.call(this, options);
	source.pause();
	options = options || {};
	this.key = options.key || new Buffer('6f6e6d6c6b6a', 'hex');
	if (!Buffer.isBuffer(this.key)) this.key = new Buffer(this.key);
	this._source = source;
    var self = this;
    // Every time there's data, we push it into the internal buffer.
    this._source.on('data', this._processChunk.bind(this));
    // When the source ends, we push the EOF-signalling `null` chunk
    this._source.on('end', function() {
    	self.push(null);
    });
    this.once('finish', function() {
    	this._source.end();
    });
}

XorWrapper.prototype._processChunk = function(chunk) {
    if (chunk !== null) {
        if (!this.push(xor(chunk, this.key))) {
        	this._source.pause();
        }
    }
};

XorWrapper.prototype._read = function(size) {
	this._source.resume();
};

XorWrapper.prototype._write = function(chunk, encoding, done) {
	this._source.write(xor(chunk, this.key), null, done);
}

module.exports = XorWrapper;

//console.log(xor(new Buffer('0102030405060708090a0b0c0d0f0102030405060708090a0b0c0d0f0102030405060708090a0b0c0d0f', 'hex'), new Buffer('0102030405060706050403020100', 'hex')).toString('hex'))