var util = require('util')
  , Duplex = require('stream').Duplex;

util.inherits(MuxWrapper, Duplex);

var extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || typeof add !== 'object') return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

var randomInt = function(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

function MuxWrapper(source, options) {
	if (!(this instanceof MuxWrapper))
	    return new MuxWrapper(source, options);
	
	Duplex.call(this, options);
	source.pause();
	
	options = options || {};
	options.idEncoding = options.idEncoding || 2;
	options.lengthEncoding = options.lengthEncoding || 2;
	
	this._source = source;
	this._buffer = new Buffer(0);

	var encodings = {
        1: { encoding: 'UInt8', min: 0, max: 256},
        2: { encoding: 'UInt16BE', min: 0, max: 65536},
        4: { encoding: 'UInt32BE', min: 0, max: 4294967296}
    }

	var header = {
		id: options.idEncoding,
		length: options.lengthEncoding
	}
	
	// create the header cache
	this._header = {};
	var headerNames = Object.keys(header);
	var index = 0;
	for (var i=0; i<headerNames.length; i++) {
		var name = headerNames[i];
		var size = header[name];
		var cache = extend({}, encodings[size]);
		cache.index = index;
		cache.size = size;
		this._header[name] = cache;
		index += size;
	}
	this._headerSize = index;
	console.dir(this._header);
	/*
	console.dir(this._header); // default options
	{
		id: {
			size: 2,
			index: 0,
			encoding: 'UInt16BE',
			min: 0,
			max: 65536
		},
		length: {
			size: 2,
			index: 2,
			encoding: 'UInt16BE',
			min: 0,
			max: 65536
		}
	}
	*/
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
	        var length = this._buffer['read'+this._header.length.encoding](this._header.length.index);
	        var id = this._buffer['read'+this._header.id.encoding](this._header.id.index);
	        var totalLength = length + this._headerSize;
	        
	        if (length == 0 && id != 1) {
	        	this._buffer = this._buffer.slice(this._headerSize);
	        	if (this._hasSubstream(id)) {
	        		var stream = this._substream(id, false);
	        		stream.push(null);
	        		//console.log('stream end');
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
	            	stream.push(payload);
	            }
	        } else {
	        	// packet incomplete
	        	break;
	        }
	    }
    }
};

MuxWrapper.prototype._writeStrem = function(id, chunk, done) {
	if (id > this._header.id.max || id < this._header.id.min)
		throw new Error('id '+id+' out of bounds for encoding '+this._header.id.encoding);
	if (chunk.length > this._header.length.max || chunk.length < this._header.length.min)
		throw new Error('chunck length '+chunk.length+' out of bounds for encoding '+this._header.length.encoding);
	
	var header = new Buffer(this._headerSize);
	header['write'+this._header.length.encoding](chunk.length, this._header.length.index);
	header['write'+this._header.id.encoding](id, this._header.id.index);
	
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

MuxWrapper.prototype.freeId = function() {
	var id = 0;
	var used = Object.keys(this.substreams);
	var freeCount = this._header.id.max - used.length - 3;
	
	if (freeCount == 0) {
		throw new Error('no free ids left! encoding: '+this._header.id.encoding);
	} else if (freeCount > Math.floor(this._header.id.max/3)) {
		//console.log('pick a random number and test');
		do {
			id = randomInt(3, this._header.id.max); // 0,1,2 are reserverd
		} while(this._hasSubstream(id));
	} else {
		//console.log('iterate and use random free id');
		var next = randomInt(0, freeCount);
		for (var i = 3; i < this._header.id.max; i++) {
			if (this._hasSubstream(i)) continue;
			if (next <= 0) {
				id = i;
				break;
			}
			next--;	
		}
	}
	return id;
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