'use strict';

var util = require('util');
var Duplex = require('stream').Duplex;
var crypto = require('crypto');
var debug = require('debug')('stream-extra:buffered_cipher');

function BufferedChipherWrapper(source, options) {
  if (!(this instanceof BufferedChipherWrapper)) {
    return new BufferedChipherWrapper(source, options);
  }

  Duplex.call(this, options);
  source.pause();
  options = options || {};
  this._source = source;

  if (!options.algorithm) {
    throw new Error('option algorithm is required');
  }

  if (!options.key) {
    throw new Error('option key is required');
  }

  this._algorithm = options.algorithm;
  this._key = options.key;
  this._iv = options.iv;

  var _this = this;

  // Every time there's data, we push it into the internal buffer.
  this._source.on('data', this._processChunk.bind(this));

  // When the source ends, we push the EOF-signalling `null` chunk
  this._source.on('end', function() {
    _this.push(null);
  });

  this.once('finish', function() {
    debug('finish, ending source');
    _this._source.end();
  });

  this._source.on('error', function(err) {
    _this.emit('error', err);
  });

  debug('wrapper created');
}

util.inherits(BufferedChipherWrapper, Duplex);

BufferedChipherWrapper.prototype._processChunk = function(chunk) {
  if (chunk !== null) {
    debug('got ' + chunk.length + ' bytes');
    var _this = this;
    var decipher;
    if (this._iv) {
      decipher = crypto.createDecipheriv(this._algorithm, this._key, this._iv);
    } else {
      decipher = crypto.createDecipher(this._algorithm, this._key);
    }

    var buffers = [];
    decipher.on('data', function(buf) {
      buffers.push(buf);
    });

    decipher.on('end', function() {
      if (!_this.push(Buffer.concat(buffers))) {
        debug('pausing source, consumer indicates no more pushes should be performed');
        _this._source.pause();
      }
    });

    decipher.on('error', function(err) {
      debug('decipher error: ' + err.message);
      _this.emit('error', err);
    });

    decipher.end(chunk);
  }
};

BufferedChipherWrapper.prototype._read = function() {
  if (this._source.isPaused()) {
    debug('resuming source, consumer read');
    this._source.resume();
  }
};

BufferedChipherWrapper.prototype._write = function(chunk, encoding, done) {
  debug('writing ' + chunk.length + ' bytes');
  var _this = this;
  var cipher;
  if (this._iv) {
    cipher = crypto.createCipheriv(this._algorithm, this._key, this._iv);
  } else {
    cipher = crypto.createCipher(this._algorithm, this._key);
  }

  var buffers = [];
  cipher.on('data', function(buf) {
    buffers.push(buf);
  });

  cipher.on('end', function() {
    _this._source.write(Buffer.concat(buffers), null, done);
  });

  cipher.on('error', function(err) {
    debug('cipher error: ' + err.message);
    _this.emit('error', err);
  });

  cipher.end(chunk);
};

module.exports = BufferedChipherWrapper;
