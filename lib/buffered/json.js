var util = require('util')
  , Duplex = require('stream').Duplex;

util.inherits(JsonWrapper, Duplex);

function JsonWrapper(source, options) {
	if (!(this instanceof JsonWrapper))
	    return new JsonWrapper(source, options);
	options = options || {};
	options.objectMode = true;
	Duplex.call(this, options);
	source.pause();
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

JsonWrapper.prototype._processChunk = function(jsonStringBuffer) {
    if (jsonStringBuffer !== null) {
    	try {
    		var payload = JSON.parse(jsonStringBuffer.toString());
            if (!this.push(payload)) {
            	this._source.pause();
            }
    	} catch (err) {
    		this.emit('error', err);
    	}
    }
};

JsonWrapper.prototype._read = function(size) {
	this._source.resume();
};

JsonWrapper.prototype._write = function(object, encoding, done) {
	try {
		this._source.write(new Buffer(JSON.stringify(object)), null, done);
	} catch (err) {
		this.emit('error', err);
	}
}

module.exports = JsonWrapper;
