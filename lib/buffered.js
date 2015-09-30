'use strict';

var util = require('util');
var Buffers = require('buffers');
var Duplex = require('stream').Duplex;
var debug = require('debug')('stream-extra:buffered');

function BufferedWrapper(source, options) {
  if (!(this instanceof BufferedWrapper)) {
    return new BufferedWrapper(source, options);
  }

  Duplex.call(this, options);
  source.pause();
  options = options || {};
  this._source = source;
  this._buffer = new Buffers();
  this._lengthSize = options.lengthEncoding || 2;
  this._lengthEncoding = {
    1: 'UInt8',
    2: 'UInt16BE',
    4: 'UInt32BE',
  }[this._lengthSize];
  this._lengthMax = {
    1: 255,
    2: 65535,
    4: 4294967295,
  }[this._lengthSize];
  var _this = this;

  // Every time there's data, we push it into the internal buffer.
  this._source.on('data', this._processChunk.bind(this));

  // When the source ends, we push the EOF-signalling `null` chunk
  this._source.on('end', function() {
    _this.push(null);
  });

  this.once('finish', function() {
    // Let the write finish befor we and the source
    process.nextTick(function() {
      debug('finish, ending source');
      _this._source.end();
    });
  });

  this._source.on('error', function(err) {
    _this.emit('error', err);
  });

  debug('wrapper with ' + this._lengthSize + ' bytes header and max chunk size of ' + this._lengthMax + ' created');
}

util.inherits(BufferedWrapper, Duplex);

BufferedWrapper.prototype._processChunk = function(chunk) {
  // if the source doesn't have data, we don't have data yet.
  if (chunk !== null) {
    this._buffer.push(chunk);
    debug('got ' + chunk.length + ' bytes');
    while (this._buffer.length >= this._lengthSize) {
      // get the length by decoding the header
      var length = this._buffer.slice(0, this._lengthSize)['read' + this._lengthEncoding](0);
      var totalLength = length + this._lengthSize;
      if (this._buffer.length >= totalLength) {

        // get and remove the header
        this._buffer.splice(0, this._lengthSize);

        // get and remove the payload
        var payload = this._buffer.splice(0, length);

        // push the payload
        debug('passing payload of ' + payload.length + ' bytes');

        if (!this.push(payload.toBuffer())) {
          this._source.pause();
          debug('pausing source, consumer indicates no more pushes should be performed');
        }
      } else {
        // packet incomplete
        break;
      }
    }
  }
};

BufferedWrapper.prototype._read = function() {
  if (this._source.isPaused()) {
    debug('resuming source, consumer read');
    this._source.resume();
  }
};

BufferedWrapper.prototype._write = function(chunk, encoding, done) {
  if (chunk.length > this._lengthMax) {
    return done(new Error('chunck length ' + chunk.length + ' out of bounds for encoding ' + this._lengthEncoding));
  }

  debug('writing ' + chunk.length + ' bytes');
  var header = new Buffer(this._lengthSize);
  header['write' + this._lengthEncoding](chunk.length, 0);
  this._source.write(Buffer.concat([header, chunk]), null, done);
};

module.exports = BufferedWrapper;
