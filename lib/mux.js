'use strict';

var util = require('util');
var Buffers = require('buffers');
var Duplex = require('stream').Duplex;
var debug = require('debug')('stream-extra:mux');

// ## helper methods
var extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || typeof add !== 'object') {
    return origin;
  }
  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

var randomInt = function(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
};

// ## Substream wrapper
function SubstreamWrapper(mux, id) {
  Duplex.call(this);
  this._mux = mux;
  this._id = id;
  var self = this;
  this.once('finish', function() {
    debug('substream ' + self._id + ' finish');
    self._mux._writeStrem(self._id, new Buffer(0), function(){
      self._mux.removeStream(id);
      debug('substream ' + self._id + ' removed');
    });
  });
  debug('substream ' + self._id + ' created');
}
util.inherits(SubstreamWrapper, Duplex);

SubstreamWrapper.prototype._read = function(size) {
  if (this._mux._source.isPaused()) {
    debug('resuming source, substream ' + this._id + ' consumer read');
    this._mux._source.resume();
  }
};

SubstreamWrapper.prototype._write = function(chunk, encoding, done) {
  debug('substream ' + this._id + ' write ' + chunk.length + ' bytes');
  this._mux._writeStrem(this._id, chunk, done);
};

// # Mux wrapper
function MuxWrapper(source, options) {
  if (!(this instanceof MuxWrapper)) {
    return new MuxWrapper(source, options);
  }
  Duplex.call(this, options);
  source.pause();
  options = options || {};
  options.idEncoding = options.idEncoding || 2;
  options.lengthEncoding = options.lengthEncoding || 2;
  this._source = source;
  this._buffer = new Buffers();
  var encodings = {
    1: { encoding: 'UInt8', min: 0, max: 255},
    2: { encoding: 'UInt16BE', min: 0, max: 65535},
    4: { encoding: 'UInt32BE', min: 0, max: 4294967295}
  };

  var header = {
    id: options.idEncoding,
    length: options.lengthEncoding
  };

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
    debug('finish, ending source');
    self._source.end();
  });

  this._source.on('error', function(err){
    self.emit('error', err);
  });
  debug('wrapper with ' + this._headerSize + ' bytes header created');
}
util.inherits(MuxWrapper, Duplex);

MuxWrapper.prototype._processChunk = function(chunk) {
  // if the source doesn't have data, we don't have data yet.
  if (chunk !== null) {
    this._buffer.push(chunk);
    debug('got ' + chunk.length + ' bytes');
    while (this._buffer.length >= this._headerSize) {
      // copy the header of the buffer array
      var header = this._buffer.slice(0, this._headerSize);
      // get the length
      var length = header['read'+this._header.length.encoding](this._header.length.index);
      // get the id
      var id = header['read'+this._header.id.encoding](this._header.id.index);
      var totalLength = length + this._headerSize;

      if (length === 0) {
        // remove the header of the buffer
        this._buffer.splice(0, this._headerSize);
        if (id === 1) {
          debug('source end mux main stream');
          this.push(null);
        } else if (this._hasSubstream(id)) {
          debug('source end substream '+id);
          this._substream(id, false).push(null);
          this.removeStream(id);
        } else {
          debug('WARNING: got end of not existing substream ' + id);
        }
      } else if (this._buffer.length >= totalLength) {
        // remove the header
        this._buffer.splice(0, this._headerSize);
        // get and remove the payload
        var payload = this._buffer.splice(0, length).toBuffer();
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
      } else {
        // packet incomplete
        break;
      }
    }
  }
};

MuxWrapper.prototype._writeStrem = function(id, chunk, done) {
  if (id > this._header.id.max || id < this._header.id.min) {
    throw new Error('stream id ' + id + ' out of bounds for encoding ' + this._header.id.encoding);
  }
  if (chunk.length > this._header.length.max || chunk.length < this._header.length.min) {
    throw new Error('chunck length ' + chunk.length + ' out of bounds for encoding ' + this._header.length.encoding);
  }
  var header = new Buffer(this._headerSize);
  header['write'+this._header.length.encoding](chunk.length, this._header.length.index);
  header['write'+this._header.id.encoding](id, this._header.id.index);

  if (id === 1) {
    debug('writing ' + chunk.length + ' bytes to mux main stream');
  } else {
    debug('writing ' + chunk.length + ' bytes to substream ' + id);
  }

  this._source.write(Buffer.concat([header, chunk]), null, done);
};

MuxWrapper.prototype._read = function(size) {
  if (this._source.isPaused()) {
    debug('resuming source, mux main stream consumer read');
    this._source.resume();
  }
};

MuxWrapper.prototype._write = function(chunk, encoding, done) {
  this._writeStrem(1, chunk, done);
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
    var self = this;
    debug('announce substream ' + id + ' creation');
    this.substreamCallbacks[id].forEach(function(callback){
      callback(self.substreams[id], id);
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
  var freeCount = this._header.id.max - used.length - 3;

  if (freeCount === 0) {
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
  if (this.substreamCallbacks[id]) {
    this.substreamCallbacks[id].push(callback);
  } else {
    this.substreamCallbacks[id] = [callback];
  }
};

module.exports = MuxWrapper;
