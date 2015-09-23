'use strict';

var util = require('util');
var crc = require('crc');
var Duplex = require('stream').Duplex;
var debug = require('debug')('stream-extra:udp');
var debugError = require('debug')('stream-extra:udp:error');
var noop = function() {};

var DATA = 0;
var ACK = 1;

var encodingMap = {
  1: 'UInt8',
  2: 'UInt16BE',
  4: 'UInt32BE',
};

var maxSizeMap = {
  1: 255,
  2: 65535,
  4: 4294967295,
};

function UDPWrapper(socket, options) {
  if (!(this instanceof UDPWrapper)) {
    return new UDPWrapper(socket, options);
  }

  if (!options || !options.address || !options.port) {
    throw new Error('address and port required');
  }

  Duplex.call(this, options);
  this._address = options.address;
  this._port = options.port;
  this._maxChunkSize = options.maxChunkSize || 1500;
  this._resendTimeout = options.messageTimeout || 500;
  this._restrictSource = options.restrictSource || false;
  this._sequenceNumber = 0;
  this._lastRemoteSequenceNumber = null;
  this._socket = socket;
  this._messages = [];
  this._sequenceNumberSize = options.sequenceNumberSize || 1;
  this._sequenceNumberEncoding = encodingMap[this._sequenceNumberSize];
  this._sequenceNumberMax = maxSizeMap[this._sequenceNumberSize];
  this._crcSize = options._crcSize || 1;
  this._crcMethod = crc['crc' + (this._crcSize * 8)];
  this._crcEncoding = encodingMap[this._crcSize];

  this._headerSize = 1 + this._sequenceNumberSize + this._crcSize;
  var _this = this;

  // Every time there's data, we push it into the internal buffer.
  this._socket.on('message', this._processMessage.bind(this));

  this._socket.on('error', function(err) {
    _this.emit('error', err);
  });

  debug('wrapper with ' + this._sequenceNumberSize + ' bytes header and max chunk size of ' + this._maxChunkSize + ' created');
}

util.inherits(UDPWrapper, Duplex);

UDPWrapper.prototype._processMessage = function(chunk, rinfo) {
  // simulate message loss
  /*
  if (Math.random() > 0.5) {
    debug('simulate message loss');
    return;
  }
  */

  if (this._restrictSource) {
    if (rinfo.address !== this._address) {
      debug('source restriction address ' + rinfo.address + ' not allowed');
      return; // ignore message
    }

    if (rinfo.port !== this._port) {
      debug('source restriction port ' + rinfo.port + ' not allowed');
      return; // ignore message
    }
  }

  // push the payload
  if (chunk.length >= this._headerSize) {
    // get the length by decoding the header
    var type = chunk.readUInt8(0);
    var sequenceNumber = chunk['read' + this._sequenceNumberEncoding](1);
    var crcStartIndex = 1 + this._sequenceNumberSize;
    var crc = chunk['read' + this._crcEncoding](crcStartIndex);

    debug('got type ' + type + ' and sequence number ' + sequenceNumber + ' from ' + rinfo.address + ':' + rinfo.port);

    if (chunk.length < this._headerSize) {
      debugError('got too small message ' + chunk.length + ' bytes');
      return; // ignore message
    }

    // check crc
    chunk['write' + this._crcEncoding](0, crcStartIndex);
    var calculatedCrc = this._crcMethod(chunk);
    if (calculatedCrc !== crc) {
      debugError('got wrong crc expected ' + crc + ' but is ' + calculatedCrc);
      return; // ignore message
    }

    if (chunk.length > this._headerSize && type === DATA) {
      // check the sequence number
      var expectedSequence = this._lastRemoteSequenceNumber + 1;
      if (this._lastRemoteSequenceNumber >= this._sequenceNumberMax) {
        expectedSequence = 0;
      }

      if (this._lastRemoteSequenceNumber === null || // we don't know the last number
          expectedSequence === sequenceNumber || // everything as expected
          sequenceNumber === 0) { // allow to reinit the sequence number
        // get and remove the header
        var payload = chunk.slice(this._headerSize);

        // push the payload
        debug('passing payload of ' + payload.length + ' bytes');

        if (!this.push(payload)) {
          debug('consumer indicates no more pushes should be performed');
        }
      } else {
        debugError('got wrong sequence number expected ' + expectedSequence + ' but is ' + sequenceNumber);
      }

      // send the ACK even if the sequence number is wrong
      debug('sending ack');
      this._lastRemoteSequenceNumber = sequenceNumber;
      this._writeMessage(ACK, sequenceNumber);
    } else if (chunk.length === this._headerSize && type === ACK && this._messages.length > 0) {
      var msg = this._messages[0];
      if (msg.sequenceNumber === sequenceNumber) {
        // got ACK for first msg
        debug('got ACK of ' + sequenceNumber);
        this._messages.shift();
        if (msg.callback) {
          msg.callback();
        }

        if (msg.resendTimeout) {
          clearTimeout(msg.resendTimeout);
        }

        this._sendMessage();
      } else if (msg.sequenceNumber > sequenceNumber) {
        debugError('got old ACK of ' + sequenceNumber + ' but first message sq is ' + msg.sequenceNumber);
      } else {
        debugError('got unkown ACK of ' + sequenceNumber + ' but first message sq is ' + msg.sequenceNumber);
      }
    } else {
      // protocol error
      debugError('protocol error');
    }
  }
};

UDPWrapper.prototype._read = function() {
  debug('consumer read');
};

UDPWrapper.prototype._write = function(chunk, encoding, done) {
  debug('_write ' + chunk.length);

  // split and only set the last callback
  var index = 0;
  while (chunk.length > index) {
    var len = chunk.length - index;
    if ((len + this._headerSize) > this._maxChunkSize) {
      len = this._maxChunkSize - this._headerSize;
    }

    var end = index + len;
    debug('chunck ' + index + ':' + end);

    if (end > chunk.length) {
      debugError('invalid chunk end');
      return;
    }

    var m = {
      data: chunk.slice(index, end),
      callback: noop,
    };

    // if last
    if (chunk.length === end) {
      m.callback = done;
    }

    debug('pushing chunk of ' + m.data.length + ' in internal buffer');
    this._messages.push(m);
    index += len;
  }

  // start
  this._sendMessage();
};

UDPWrapper.prototype._writeMessage = function(type, sequenceNumber, chunk) {
  if (chunk) {
    debug('writing sq ' + sequenceNumber + ' type ' + type + ' ' + chunk.length + ' bytes');
  } else {
    debug('writing sq ' + sequenceNumber + ' type ' + type);
  }

  var header = new Buffer(this._headerSize);
  header.writeUInt8(type, 0);
  header['write' + this._sequenceNumberEncoding](sequenceNumber, 1);

  // write 0 crc
  var crcStartIndex = 1 + this._sequenceNumberSize;
  header['write' + this._crcEncoding](0, crcStartIndex);
  var message;
  if (chunk) {
    message = Buffer.concat([header, chunk]);
  } else {
    message = header;
  }

  var crc = this._crcMethod(message);
  message['write' + this._crcEncoding](crc, crcStartIndex);

  // simulate transmission error
  /*
  if (Math.random() > 0.5) {
    debug('simulate simulate transmission error');
    message.writeUInt16BE(Math.random() * 65535, 0);
  }
  */
  try {
    this._socket.send(message, 0, message.length, this._port, this._address);
  } catch (e) {
    this.emit('error', e);
  }
};

UDPWrapper.prototype._getAndIncreaseSequenceNumber = function() {
  var sq = this._sequenceNumber;
  if (this._sequenceNumber >= this._sequenceNumberMax) {
    this._sequenceNumber = 0;
  } else {
    this._sequenceNumber++;
  }

  return sq;
};

UDPWrapper.prototype._sendMessage = function() {
  if (!this._messages.length) {
    return null;
  }

  var _this = this;
  var msg = this._messages[0];
  if (!msg.waitingForACK) {
    msg.waitingForACK = true;
    msg.sequenceNumber = this._getAndIncreaseSequenceNumber();
    msg.resendTimeout = setTimeout(function() {
      msg.resendTimeout = null;
      msg.needResend = true;
      _this._sendMessage();
    }, this._resendTimeout);
    this._writeMessage(DATA, msg.sequenceNumber, msg.data);
  } else if (msg.needResend && msg.waitingForACK) {
    msg.needResend = false;
    msg.resendTimeout = setTimeout(function() {
      msg.resendTimeout = null;
      msg.needResend = true;
      _this._sendMessage();
    }, this._resendTimeout);
    this._writeMessage(DATA, msg.sequenceNumber, msg.data);
  }

};

UDPWrapper.createServer = function(socket, options, connectionListener) {
  debug('createServer');
  if (connectionListener === undefined) {
    connectionListener = options;
  }

  var register = {};
  socket.on('message', function(data, rinfo) {
    var id = rinfo.address + ':' + rinfo.port;
    if (!register[id]) {
      var stream = new UDPWrapper(socket, {
        address: rinfo.address,
        port: rinfo.port,
        restrictSource: true,
        maxChunkSize: options.maxChunkSize,
      });
      register[id] = stream;
      connectionListener(stream, rinfo);
    }
  });
};

module.exports = UDPWrapper;
