var util = require('util')
  , Duplex = require('stream').Duplex
  , zlib = require('zlib');

util.inherits(ZlibWrapper, Duplex);

function ZlibWrapper(source, options) {
	if (!(this instanceof ZlibWrapper))
	    return new ZlibWrapper(source, options);
	
	Duplex.call(this, options);
	source.pause();
	options = options || {};
	this._source = source;
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

ZlibWrapper.prototype._processChunk = function(chunk) {
    if (chunk !== null) {
    	var self = this;
    	zlib.unzip(chunk, function(err, payload) {
    		if (err) return this.emit('error', err);
            if (!self.push(payload)) {
            	self._source.pause();
            }
    	});
    }
};

ZlibWrapper.prototype._read = function(size) {
	this._source.resume();
};

ZlibWrapper.prototype._write = function(chunk, encoding, done) {
	var self = this;
	zlib.deflate(chunk, function(err, buffer) {
		if (err) return this.emit('error', err);
		self._source.write(buffer, null, done);
	});
}

module.exports = ZlibWrapper;