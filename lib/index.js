

var BufferedWrapper = exports.Buffered = require('./buffered');
var MuxWrapper = exports.Mux = require('./mux');
var ZlibWrapper = exports.Buffered.Zlib  = require('./buffered/zlib');
var JsonWrapper = exports.Buffered.Json = require('./buffered/json');
var RpcTransform = exports.Buffered.Json.Rpc = require('./buffered/json/rpc');
var CipherWrapper = exports.Cipher = require('./cipher');


exports.json = function(socket) {
	return new JsonWrapper(
		new ZlibWrapper(
			new BufferedWrapper(socket)
		)
	);
}