'use strict';

var BufferedWrapper = exports.Buffered = require('./buffered');
var ZlibWrapper = exports.Buffered.Zlib  = require('./buffered/zlib');
var JsonWrapper = exports.Buffered.Json = require('./buffered/json');
exports.Mux = require('./mux');
exports.Buffered.Json.Rpc = require('./buffered/json/rpc');
exports.Cipher = require('./cipher');

exports.json = function(socket) {
  return new JsonWrapper(
    new ZlibWrapper(
      new BufferedWrapper(socket)
    )
  );
};
