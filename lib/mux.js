var util = require('util')
  , Duplex = require('stream').Duplex;

util.inherits(MuxWrapper, Duplex);

function MuxWrapper(source, options) {
	if (!(this instanceof MuxWrapper))
	    return new MuxWrapper(source, options);
	
	Duplex.call(this, options);
	source.pause();
	options = options || {};
	this._source = source;
	this._buffer = new Buffer(0);
	this._lengthSize = options.lengthSize || 2;
	this._idSize = options.idSize || 2;
	var encodings = {
        1: 'UInt8',
        2: 'UInt16BE',
        4: 'UInt32BE'
    }
	this._lengthEncoding = encodings[this._lengthSize];
    this._idEncoding = encodings[this._idSize];
    this._headerSize = this._idSize + this._lengthSize;
    this.substreamCallbacks = {};
    this.substreams = {};
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

MuxWrapper.prototype._processChunk = function(chunk) {
	// if the source doesn't have data, we don't have data yet.
    if (chunk !== null) {
	    this._buffer = Buffer.concat([this._buffer, chunk]);
	    while (this._buffer.length >= this._headerSize) {
	    	// get the length by decoding the header
	        var length = this._buffer['read'+this._lengthEncoding](0);
	        var id = this._buffer['read'+this._idEncoding](this._lengthSize);
	        var totalLength = length + this._headerSize;
	        
	        if (length == 0 && id != 1) {
	        	this._buffer = this._buffer.slice(this._headerSize);
	        	if (this._hasSubstream(id)) {
	        		var stream = this._substream(id, false);
	        		stream.push(null);
	        		console.log('stream end');
	        		this.removeStream(id);
	        	}
	        } else if (this._buffer.length >= totalLength) {
	        	// get the payload
	            var payload = this._buffer.slice(this._headerSize, totalLength);
	            // store the remaining data in the buffer
	            this._buffer = this._buffer.slice(totalLength);
	            // push the payload
	            if (id == 1) {
		            if (!this.push(payload)) {
		            	this._source.pause();
		            }
	            } else {
	            	var stream = this._substream(id, true) // triggers once callback
	            	//process.nextTick(function(){
	            		stream.push(payload);
	            	//});
	            }
	        } else {
	        	// packet incomplete
	        	break;
	        }
	    }
    }
};

MuxWrapper.prototype._writeStrem = function(id, chunk, done) {
	var header = new Buffer(this._headerSize);
	header['write'+this._lengthEncoding](chunk.length, 0);
	header['write'+this._idEncoding](id, this._lengthSize);
	this._source.write(Buffer.concat([header, chunk]), null, done);
}

MuxWrapper.prototype._read = function(size) {
	this._source.resume();
};

MuxWrapper.prototype._write = function(chunk, encoding, done) {
	this._writeStrem(1, chunk, done);
}

MuxWrapper.prototype._hasSubstream = function(id) {
	return (!!this.substreams[id]);
}

MuxWrapper.prototype._substream = function(id, announce) {
	if (this.substreams[id]) return this.substreams[id];
	this.substreams[id] = new SubstreamWrapper(this, id);
	if (announce && this.substreamCallbacks[id]) {
		var self = this;
		this.substreamCallbacks[id].forEach(function(callback){
			callback(self.substreams[id], id);
		});
		delete this.substreamCallbacks[id];
	}
	return this.substreams[id];
}

MuxWrapper.prototype.removeStream = function(id) {
	if (this.substreamCallbacks[id]) {
		delete this.substreamCallbacks[id];
	}
	if (this.substreams[id]) {
		delete this.substreams[id];
	}
}

MuxWrapper.prototype.createStream = function(id) {
	return this._substream(id, false);
}

MuxWrapper.prototype.onceStream = function(id, callback) {
	if (this.substreamCallbacks[id]) {
		this.substreamCallbacks[id].push(callback);
	} else {
		this.substreamCallbacks[id] = [callback];
	}
}

util.inherits(SubstreamWrapper, Duplex);

function SubstreamWrapper(mux, id) {
	Duplex.call(this);
	this._mux = mux;
	this._id = id;
	var self = this;
	this.once('finish', function() {
		//console.log('remove substream');
		self._mux._writeStrem(self._id, new Buffer(0), function(){
			//console.log('remove substream empty written');
			self._mux.removeStream(id);
		});
    });
}

SubstreamWrapper.prototype._read = function(size) {
	// do nothing, mux will push the data
};

SubstreamWrapper.prototype._write = function(chunk, encoding, done) {
	this._mux._writeStrem(this._id, chunk, done);
}

module.exports = MuxWrapper;