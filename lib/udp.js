'use strict';

var util = require('util');
var Duplex = require('stream').Duplex;
var debug = require('debug')('stream-extra:udp');

var DATA = 0;
var ACK = 1;

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
  this._sequenceNumber = 0;
  this._lastRemoteSequenceNumber = null;
  this._socket = socket;
  this._messages = [];
  this._sequenceNumberSize = options.sequenceNumberEncoding || 2;
  this._sequenceNumberEncoding = {
    1: 'UInt8',
    2: 'UInt16BE',
    4: 'UInt32BE',
  }[this._sequenceNumberSize];
  this.sequenceNumberMax = {
    1: 255,
    2: 65535,
    4: 4294967295,
  }[this._sequenceNumberSize];

  this._headerSize = this._sequenceNumberSize + 1;
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
  // TODO: send ack of msg
  // (optional) set address & port from rinfo

  // simulate message loss
  /*
  if (Math.random() > 0.5) {
    debug('simulate message loss');
    return;
  }
  */

  // push the payload
  if (chunk.length >= this._headerSize) {
    // get the length by decoding the header
    var type = chunk.readUInt8(0);
    var sequenceNumber = chunk['read' + this._sequenceNumberEncoding](1);

    debug('got type ' + type + ' and sequence number ' + sequenceNumber + ' from ' + rinfo.address + ':' + rinfo.port);

    if (chunk.length > this._headerSize && type === DATA) {
      // check the sequence number
      if (this._lastRemoteSequenceNumber === null || this._lastRemoteSequenceNumber === (sequenceNumber - 1)) {
        // get and remove the header
        var payload = chunk.slice(this._headerSize);

        // push the payload
        debug('passing payload of ' + payload.length + ' bytes');

        if (!this.push(payload)) {
          debug('consumer indicates no more pushes should be performed');
        }
      } else {
        debug('got wrong sequence number');
      }

      // send the ACK even if the sequence number is wrong
      debug('sending ack');
      this._lastRemoteSequenceNumber = sequenceNumber;
      this._writeMessage(ACK, sequenceNumber);

    } else if (chunk.length === this._headerSize && type === ACK) {
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
        debug('got old ACK of ' + sequenceNumber + ' but first message sq is ' + msg.sequenceNumber);
      } else {
        debug('got unkown ACK of ' + sequenceNumber + ' but first message sq is ' + msg.sequenceNumber);
      }
    } else {
      // packet error
      debug('packet error!!!!');
    }
  }
};

UDPWrapper.prototype._read = function() {
  debug('consumer read');
};

UDPWrapper.prototype._write = function(chunk, encoding, done) {
  if (chunk.length > this._maxChunkSize) {
    //TODO: split and only set the last callback
    return done(new Error('chunck length ' + chunk.length + ' out of bounds'));
  }

  //save chunk and callback to this._messages array

  this._messages.push({
    data: chunk,
    callback: done,
  });

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
  var message;
  if (chunk) {
    message = Buffer.concat([header, chunk]);
  } else {
    message = header;
  }

  this._socket.send(message, 0, message.length, this._port, this._address);
};

// send loop;
UDPWrapper.prototype._sendMessage = function() {
  if (!this._messages.length) {
    return null;
  }

  var _this = this;
  var msg = this._messages[0];
  if (!msg.waitingForACK) {
    msg.waitingForACK = true;
    msg.sequenceNumber = this._sequenceNumber;
    msg.resendTimeout = setTimeout(function() {
      msg.resendTimeout = null;
      msg.needResend = true;
      _this._sendMessage();
    }, this._resendTimeout);
    this._sequenceNumber++;
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

module.exports = UDPWrapper;
