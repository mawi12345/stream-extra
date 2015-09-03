'use strict';

var util = require('util');
var Duplex = require('stream').Duplex;
var debug = require('debug')('stream-extra:json');

function JsonWrapper(source, options) {
  if (!(this instanceof JsonWrapper)) {
    return new JsonWrapper(source, options);
  }

  options = options || {};
  options.objectMode = true;
  Duplex.call(this, options);
  source.pause();
  this._source = source;
  var _this = this;

  // Every time there's data, we push it into the internal buffer.
  this._source.on('data', this._processChunk.bind(this));

  // When the source ends, we push the EOF-signalling `null` chunk
  this._source.on('end', function() {
    _this.push(null);
  });

  this._source.on('error', function(err) {
    _this.emit('error', err);
  });

  this.once('finish', function() {
    debug('finish, ending source');
    _this._source.end();
  });

  debug('wrapper created');
}

util.inherits(JsonWrapper, Duplex);

JsonWrapper.prototype._processChunk = function(jsonStringBuffer) {
  if (jsonStringBuffer !== null) {
    debug('got ' + jsonStringBuffer.length + ' bytes');
    try {
      var payload = JSON.parse(jsonStringBuffer.toString());
      if (!this.push(payload)) {
        debug('pausing source, consumer indicates no more pushes should be performed');
        this._source.pause();
      }
    } catch (err) {
      this.emit('error', err);
    }
  }
};

JsonWrapper.prototype._read = function() {
  if (this._source.isPaused()) {
    debug('resuming source, consumer read');
    this._source.resume();
  }
};

JsonWrapper.prototype._write = function(object, encoding, done) {
  try {
    var chunk = new Buffer(JSON.stringify(object));
    debug('writing ' + chunk.length + ' bytes');
    this._source.write(chunk, null, done);
  } catch (err) {
    this.emit('error', err);
  }
};

module.exports = JsonWrapper;
