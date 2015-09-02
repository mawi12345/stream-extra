'use strict';

var util = require('util');
var crypto = require('crypto');
var Duplex = require('stream').Duplex;
var debug = require('debug')('stream-extra:cipher');

function CipherWrapper(source, options) {
  if (!(this instanceof CipherWrapper)) {
    return new CipherWrapper(source, options);
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

  if (options.iv) {
    this._cipher = crypto.createCipheriv(options.algorithm, options.key, options.iv);
    this._decipher = crypto.createDecipheriv(options.algorithm, options.key, options.iv);
  } else {
    this._cipher = crypto.createCipher(options.algorithm, options.key);
    this._decipher = crypto.createDecipher(options.algorithm, options.key);
  }

  this._source.pipe(this._decipher);
  this._cipher.pipe(this._source);

  var self = this;
  // Every time there's data, we push it into the internal buffer.
  this._decipher.on('data', function(chunk) {
    debug('decipher got ' + chunk.length + ' bytes');
    if (!self.push(chunk)) {
      debug('pausing source, consumer indicates no more pushes should be performed');
      self._source.pause();
    }
  });
  // When the source ends, we push the EOF-signalling `null` chunk
  this._source.on('end', function() {
    debug('source end');
    self.push(null);
  });

  this._decipher.on('end', function() {
    debug('decipher end');
    self.push(null);
  });

  this.once('finish', function() {
    debug('finish, ending cipher and source');
    self._cipher.end();
    self._source.end();
  });

  this._source.on('error', function(err){
    self.emit('error', err);
  });

  debug('wrapper with algorithm ' + options.algorithm + ' created');
}
util.inherits(CipherWrapper, Duplex);

CipherWrapper.prototype._read = function(size) {
  if (this._source.isPaused()) {
    debug('resuming source, consumer read');
    this._source.resume();
  }
};

CipherWrapper.prototype._write = function(chunk, encoding, done) {
  debug('write ' + chunk.length + ' bytes to cipher');
  this._cipher.write(chunk, encoding, done);
};

module.exports = CipherWrapper;
