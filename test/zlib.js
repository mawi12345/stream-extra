/*global
  describe, it
*/

'use strict';

var ZlibWrapper = require('../lib/buffered/zlib');
var bufferedTestFactory = require('./spec/buffered');
var BufferedWrapper = require('../lib/buffered');
var EventEmitter = require('events').EventEmitter;
var spam = require('./helpers').spam;
var noop = function() {
};

describe('ZlibWrapper', function() {

  bufferedTestFactory(ZlibWrapper, function(source, options) {
    return new ZlibWrapper(new BufferedWrapper(source, options), options);
  });

  it('should stop the source if the consumer does not want more data', function(done) {
    var mock = new EventEmitter();
    var stopped = false;
    var hasStarted = false;
    mock.resume = noop;
    mock.isPaused = function() {
      return false;
    };

    mock.pause = function() {
      if (!stopped && hasStarted) {
        stopped = true;
        done();
      }
    };

    var bufferedStream = new ZlibWrapper(new BufferedWrapper(mock));
    var bigChunk = new Buffer(spam('hello world'));
    hasStarted = true;
    mock.emit('data', bigChunk);
  });
});
