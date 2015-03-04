var util = require('util')
  , Buffers = require('buffers')
  , Duplex = require('stream').Duplex;

util.inherits(BufferedWrapper, Duplex);

function BufferedWrapper(source, options) {
	if (!(this instanceof BufferedWrapper))
	    return new BufferedWrapper(source, options);
	
	Duplex.call(this, options);
	source.pause();
	options = options || {};
	this._source = source;
	this._buffer = new Buffers();
	this._lengthSize = options.lengthEncoding || 2;
    this._lengthEncoding = {
        1: 'UInt8',
        2: 'UInt16BE',
        4: 'UInt32BE'
    }[this._lengthSize];
    
	var self = this;
	// Every time there's data, we push it into the internal buffer.
	this._source.on('data', this._processChunk.bind(this));
	// When the source ends, we push the EOF-signalling `null` chunk
	this._source.on('end', function() {
    	self.push(null);
    });
	
    this.once('finish', function() {
    	self._source.end();
	});
    
    this._source.on('error', function(err){
    	self.emit('error', err)
    });
}

BufferedWrapper.prototype._processChunk = function(chunk) {
    // if the source doesn't have data, we don't have data yet.
    if (chunk !== null) {
	    this._buffer.push(chunk);
	    while (this._buffer.length >= this._lengthSize) {
	    	// get the length by decoding the header
	        var length = this._buffer.slice(0, this._lengthSize)['read'+this._lengthEncoding](0);
	        var totalLength = length + this._lengthSize;
	        
	        if (this._buffer.length >= totalLength) {
	        	// get and remove the header
	        	var header = this._buffer.splice(0, this._lengthSize);
	        	// get and remove the payload
	            var payload = this._buffer.splice(0, length);
	            // push the payload
	            if (!this.push(payload.toBuffer())) {
	            	this._source.pause();
	            }
	        } else {
	        	// packet incomplete
	        	break;
	        }
	    }
    }
};

BufferedWrapper.prototype._read = function(size) {
	this._source.resume();
};

BufferedWrapper.prototype._write = function(chunk, encoding, done) {
	var header = new Buffer(this._lengthSize);
	header['write'+this._lengthEncoding](chunk.length, 0);
	this._source.write(Buffer.concat([header, chunk]), null, done);
}

module.exports = BufferedWrapper;