var util = require('util')
  , Duplex = require('stream').Duplex
  , PassThrough = require('stream').PassThrough;

util.inherits(Duplexer, Duplex);

function Duplexer(options) {
	Duplex.call(this, options);
	options = options || {};
	this.writer = options.writer || new PassThrough();
	this.reader = options.reader || new PassThrough();
	this.name = options.name || '>';
	this.log = options.log || true;
	this.encodig = options.encodig || 'hex';
	var self = this;
	this.reader.on('data', function(chunk) {
		if (!self.push(chunk))
			this.reader.pause();
	});
	
	this.reader.on('finish', function(chunk) {
		self.push(null);
	});
}

Duplexer.prototype._read = function(size) {
	this.reader.resume();
};

Duplexer.prototype._write = function(chunk, encoding, done) {
	if (this.log) console.log(this.name, chunk.toString(this.encodig));
	this.writer.write(chunk, encoding, done);
}

exports.Duplexer = Duplexer;

exports.createCrossover = function(optionsA, optionsB) {
	var a = new Duplexer(optionsA);
	optionsB = optionsB || {};
	optionsB.reader = a.writer;
	optionsB.writer = a.reader;
	optionsB.name = optionsB.name || '<';
	var b = new Duplexer(optionsB);
	return [a,b];
}