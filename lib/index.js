

var BufferedWrapper = exports.BufferedWrapper = require('./buffered');
var ZlibWrapper = exports.ZlibWrapper  = require('./buffered/zlib');
var JsonWrapper = exports.JsonWrapper = require('./buffered/json');

exports.json = function(socket) {
	return new JsonWrapper(
		new ZlibWrapper(
			new BufferedWrapper(socket)
		)
	);
}

// ########
// unstable
exports._XorWrapper = require('./buffered/xor');