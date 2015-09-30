'use strict';

exports.Buffered = require('./buffered');
exports.ZLib = require('./buffered/zlib');
exports.JSON = require('./buffered/json');
exports.Mux = require('./mux');
exports.RPC = require('./buffered/json/rpc');
exports.Cipher = require('./cipher');
exports.BufferedCipher = require('./buffered/cipher');
exports.UDP = require('./udp');

exports.createJSONStream = function(socket, options) {
  var bufferdStream = new exports.Buffered(socket, options);
  var compressedStream = new exports.ZLib(bufferdStream, options);
  return new exports.JSON(compressedStream, options);
};

exports.createRPC = function(socket, handler, options) {
  var multiplexedStream = new exports.Mux(socket, options);
  var compressedStream = new exports.ZLib(multiplexedStream, options);
  var jsonStream = new exports.JSON(compressedStream, options);
  var rpc = new exports.RPC(jsonStream, handler, options);
  rpc.mux = multiplexedStream;
  return rpc;
};
