var util = require('util')
  , Transform = require('stream').Transform

util.inherits(WireLogger, Transform);

function WireLogger(options) {
	if (!(this instanceof WireLogger))
		return new WireLogger(options);
	Transform.call(this, options);
	options = options || {};
	this.name = options.name || 'wire';
}

WireLogger.prototype._transform = function(chunk, encoding, done) {
	console.log(this.name, chunk.length, chunk.toString('hex'));
	this.push(chunk);
	done();
};

module.exports = WireLogger;