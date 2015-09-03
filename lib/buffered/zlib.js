'use strict';

var util = require('util');
var Duplex = require('stream').Duplex;
var zlib = require('zlib');
var debug = require('debug')('stream-extra:zlib');

function ZlibWrapper(source, options) {
  if (!(this instanceof ZlibWrapper)) {
    return new ZlibWrapper(source, options);
  }

  Duplex.call(this, options);
  source.pause();
  options = options || {};
  this._source = source;
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

util.inherits(ZlibWrapper, Duplex);

ZlibWrapper.prototype._processChunk = function(chunk) {
  if (chunk !== null) {
    debug('got ' + chunk.length + ' bytes');
    var _this = this;
    zlib.unzip(chunk, function(err, payload) {
      if (err) {
        return _this.emit('error', err);
      }

      if (!_this.push(payload)) {
        debug('pausing source, consumer indicates no more pushes should be performed');
        _this._source.pause();
      }
    });
  }
};

ZlibWrapper.prototype._read = function() {
  if (this._source.isPaused()) {
    debug('resuming source, consumer read');
    this._source.resume();
  }
};

ZlibWrapper.prototype._write = function(chunk, encoding, done) {
  debug('writing ' + chunk.length + ' bytes');
  var _this = this;
  zlib.deflate(chunk, function(err, buffer) {
    if (err) {
      return _this.emit('error', err);
    }

    _this._source.write(buffer, null, done);
  });
};

module.exports = ZlibWrapper;
