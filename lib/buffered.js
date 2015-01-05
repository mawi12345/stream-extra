var util = require('util')
  , Duplex = require('stream').Duplex;

util.inherits(BufferedWrapper, Duplex);

function BufferedWrapper(source, options) {
	if (!(this instanceof BufferedWrapper))
	    return new BufferedWrapper(source, options);
	
	Duplex.call(this, options);
	source.pause();
	options = options || {};
	this._source = source;
	this._buffer = new Buffer(0);
	this._lengthPrefix = options.lengthPrefix || 2;
    this._headerEncoding = {
        1: 'UInt8',
        2: 'UInt16BE',
        4: 'UInt32BE'
    }[this._lengthPrefix];
    
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

BufferedWrapper.prototype._processChunk = function(chunk) {
	// if the source doesn't have data, we don't have data yet.
    if (chunk !== null) {
	    this._buffer = Buffer.concat([this._buffer, chunk]);
	    if (this._buffer.length > this._lengthPrefix) {
	    	// get the length by decoding the header
	        this._length = this._buffer['read'+this._headerEncoding](0);
	        var totalLength = this._length + this._lengthPrefix;
	        if (this._buffer.length >= totalLength) {
	        	// get the payload
	            var payload = this._buffer.slice(this._lengthPrefix, totalLength);
	            // store the remaining data in the buffer
	            this._buffer = this._buffer.slice(totalLength);
	            // push the payload
	            if (!this.push(payload)) {
	            	this._source.pause();
	            }
	        } 
	    }
    }
};

BufferedWrapper.prototype._read = function(size) {
	this._source.resume();
};

BufferedWrapper.prototype._write = function(chunk, encoding, done) {
	var header = new Buffer(this._lengthPrefix);
	header['write'+this._headerEncoding](chunk.length, 0);
	this._source.write(Buffer.concat([header, chunk]), null, done);
}

module.exports = BufferedWrapper;