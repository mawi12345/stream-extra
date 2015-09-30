'use strict';

var util = require('util');
var Duplex = require('stream').Duplex;
var debug = require('debug')('stream-extra:mux');

var randomInt = function(low, high) {
  return Math.floor(Math.random() * (high - low) + low);
};

// ## Substream wrapper
function SubstreamWrapper(mux, id) {
  Duplex.call(this);
  this.debug = require('debug')('stream-extra:mux:substream:' + id);
  this._mux = mux;
  this._id = id;
  var _this = this;
  this.once('finish', function() {
    _this.debug('finish, writing 0 bytes');
    _this._mux._writeStream(_this._id, new Buffer(0), function() {
      _this.debug('finished writing 0 bytes - removing stream from mux');
      _this._mux.removeStream(id);
    });
  });

  this._mux.on('error', function(err) {
    _this.emit('error', err);
  });

  this.debug('created');
}

util.inherits(SubstreamWrapper, Duplex);

SubstreamWrapper.prototype._read = function() {
  if (this._mux._source.isPaused()) {
    this.debug('resuming source, consumer read');
    this._mux._source.resume();
  }
};

SubstreamWrapper.prototype._write = function(chunk, encoding, done) {
  this.debug('write ' + chunk.length + ' bytes');
  this._mux._writeStream(this._id, chunk, done);
};

// # Mux wrapper
function MuxWrapper(source, options) {
  if (!(this instanceof MuxWrapper)) {
    return new MuxWrapper(source, options);
  }

  options = options || {};

  Duplex.call(this, options);
  source.pause();

  this._source = source;
  this._idSize = options.idEncoding || 2;
  this._idEncoding = {
    1: 'UInt8',
    2: 'UInt16BE',
    4: 'UInt32BE',
  }[this._idSize];
  this._idMax = {
    1: 255,
    2: 65535,
    4: 4294967295,
  }[this._idSize];

  this.substreamCallbacks = {};
  this.substreams = {};

  // Every time there's data, we push it into the internal buffer.
  this._source.on('data', this._processChunk.bind(this));

  var _this = this;

  // When the source ends, we push the EOF-signalling `null` chunk
  this._source.on('end', function() {
    _this.push(null);
  });

  this.once('finish', function() {
    // if a substream gets closed in this tick we want to close the
    // source afterwards.
    process.nextTick(function() {
      debug('finish, ending source');
      _this._source.end();
    });
  });

  this._source.on('error', function(err) {
    _this.emit('error', err);
  });

  debug('wrapper with ' + this._idSize + ' bytes header created');
}

util.inherits(MuxWrapper, Duplex);

MuxWrapper.prototype._processChunk = function(chunk) {
  // if the source doesn't have data, we don't have data yet.
  if (chunk !== null) {
    debug('got ' + chunk.length + ' bytes');
    if (chunk.length >= this._idSize) {
      // get the id
      var id = chunk['read' + this._idEncoding](0);
      var length = chunk.length - this._idSize;

      if (length === 0) {
        if (id === 1) {
          throw new Error('the mux main stream has to be ended by the wrapped source');
        } else if (this._hasSubstream(id)) {
          debug('source end substream ' + id);
          this._substream(id, false).push(null);
          this.removeStream(id);
        } else {
          debug('WARNING: got end of not existing substream ' + id);
        }
      } else {
        // get the payload
        var payload = chunk.slice(this._idSize);

        // push the payload
        if (id === 1) {
          debug('passing payload of ' + payload.length + ' bytes to main mux stream');
          if (!this.push(payload)) {
            // Not sure if we should pause all streams if one is full!?
            // this._source.pause();
            debug('WARNING: main mux stream indicates no more pushes should be performed');
          }
        } else {
          debug('passing payload of ' + payload.length + ' bytes substream ' + id);

          // true -> triggers once callback
          if (!this._substream(id, true).push(payload)) {
            // Not sure if we should pause all streams if one is full!?
            // this._source.pause();
            debug('WARNING: substream ' + id + ' indicates no more pushes should be performed');
          }
        }
      }
    } else {
      debug('WARNING: chunk smaller than id size');
    }
  }
};

MuxWrapper.prototype._writeStream = function(id, chunk, done) {
  if (id > this._idMax || id < 0) {
    return done(new Error('stream id ' + id + ' out of bounds for encoding ' + this._header.id.encoding));
  }

  var header = new Buffer(this._idSize);
  header['write' + this._idEncoding](id, 0);

  if (id === 1) {
    debug('writing ' + chunk.length + ' bytes to mux main stream');
  } else {
    debug('writing ' + chunk.length + ' bytes to substream ' + id);
  }

  this._source.write(Buffer.concat([header, chunk]), null, done);
};

MuxWrapper.prototype._read = function() {
  if (this._source.isPaused()) {
    debug('resuming source, mux main stream consumer read');
    this._source.resume();
  }
};

MuxWrapper.prototype._write = function(chunk, encoding, done) {
  this._writeStream(1, chunk, done);
};

MuxWrapper.prototype._hasSubstream = function(id) {
  return (!!this.substreams[id]);
};

MuxWrapper.prototype._substream = function(id, announce) {
  if (this.substreams[id]) {
    return this.substreams[id];
  }

  this.substreams[id] = new SubstreamWrapper(this, id);

  if (announce && this.substreamCallbacks[id]) {
    var _this = this;
    debug('announce substream ' + id + ' creation');
    this.substreamCallbacks[id].forEach(function(callback) {
      callback(_this.substreams[id], id);
    });

    delete this.substreamCallbacks[id];
  }

  return this.substreams[id];
};

MuxWrapper.prototype.removeStream = function(id) {
  debug('removing substream ' + id);
  if (this.substreamCallbacks[id]) {
    delete this.substreamCallbacks[id];
  }

  if (this.substreams[id]) {
    delete this.substreams[id];
  }
};

MuxWrapper.prototype.freeId = function() {
  var id = 0;
  var used = Object.keys(this.substreams);
  var freeCount = this._idMax - used.length - 3;

  if (freeCount === 0) {
    throw new Error('no free ids left! encoding: ' + this._header.id.encoding);
  } else if (freeCount > Math.floor(this._idMax / 3)) {
    //console.log('pick a random number and test');
    do {
      id = randomInt(3, this._idMax); // 0,1,2 are reserverd
    } while (this._hasSubstream(id));
  } else {
    //console.log('iterate and use random free id');
    var next = randomInt(0, freeCount);
    for (var i = 3; i < this._idMax; i++) {
      if (this._hasSubstream(i)) {
        continue;
      }

      if (next <= 0) {
        id = i;
        break;
      }

      next--;
    }
  }

  return id;
};

MuxWrapper.prototype.createStream = function(id) {
  return this._substream(id, false);
};

MuxWrapper.prototype.onceStream = function(id, callback) {
  if (id < 2) {
    // id 1 = mux main stream, id 0 = reserved.
    throw new Error('invalid stream id');
  }

  if (this.substreamCallbacks[id]) {
    this.substreamCallbacks[id].push(callback);
  } else {
    this.substreamCallbacks[id] = [callback];
  }

  if (this._source.isPaused()) {
    debug('resuming source, mux onceStream called');
    this._source.resume();
  }
};

module.exports = MuxWrapper;
