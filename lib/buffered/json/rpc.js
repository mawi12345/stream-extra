var crypto = require('crypto')
  , Q = require('q');

function RpcWrapper(source, handler, options) {
	if (!(this instanceof RpcWrapper))
	    return new RpcWrapper(source, options);
	this._source = source;
	this._handler = handler;
	this._deferreds = {};
	options = options || {};
	this._cidLength = options.cidLength || 16;
	// Every time there's data, we push it into the internal buffer.
	this._source.on('data', this._process.bind(this));
	
	var self = this;
	this._source.on('error', function(err){
		self.end(err);
	});
}

RpcWrapper.prototype._newCid = function() {
    return crypto.randomBytes(Math.ceil(this._cidLength/2))
    	.toString('hex') // convert to hexadecimal format
    	.slice(0,this._cidLength);   // return required number of characters
}

RpcWrapper.prototype.end = function(err) {
	if (!err) err = new Error('rpc end');
	var deferreds = this._deferreds;
	Object.keys(this._deferreds).forEach(function(key){
		deferreds[key].reject(err);
	});
}


RpcWrapper.prototype._process = function(data) {
	if (!data || !data.cid)
		throw new Error('rpc transform received invalid data');
	
	if (data.method) {
		// got a request
		if (this._handler[data.method] instanceof Function) {
			var self = this;
			this._handler[data.method](data.params)
			.then(function (result) {
			    // Success 
				self._source.write({
					cid: data.cid,
					result: result
				});
			}, function (err) {
			    // There was an error
				self._source.write({
					cid: data.cid,
					error: err.message
				});
			}, function (progress) {
			    // We get notified of the progress as it is executed
				self._source.write({
					cid: data.cid,
					progress: progress
				});
			});
		} else {
			this._source.write({
				cid: data.cid,
				error: 'method \''+data.method+'\' not found'
			});
		}
	} else {
		// got a response
		var deferred = this._deferreds[data.cid];
		if (!deferred)
			throw new Error('rpc transform received response to unkown request');
		
		if (data.error) {
			delete this._deferreds[data.cid];
			deferred.reject(new Error(data.error));
		} else if (data.progress) {
			deferred.notify(data.progress);
		} else {
			delete this._deferreds[data.cid];
			deferred.resolve(data.result);
		}
	}
};

RpcWrapper.prototype.call = function(method, params) {
	var cid = null;
	do {
		cid = this._newCid();
	} while(this._deferreds[cid]);
	
	var deferred = Q.defer();
	
	this._source.write({
		cid: cid,
		method: method,
		params: params
	});
	
	this._deferreds[cid] = deferred;
	return deferred.promise;
}

module.exports = RpcWrapper;


