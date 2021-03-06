/*global
  describe, it
*/

'use strict';

var bufferedTestFactory = require('./spec/buffered');
var BufferedWrapper = require('../lib/buffered');
var EventEmitter = require('events').EventEmitter;
var spam = require('./helpers').spam;
var noop = function() {
};

describe('BufferedWrapper', function() {

  bufferedTestFactory(BufferedWrapper, function(source, options) {
    return new BufferedWrapper(source, options);
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

    var bufferedStream = new BufferedWrapper(mock);
    var bigChunk = new Buffer(spam('hello world'));
    hasStarted = true;
    mock.emit('data', bigChunk);
  });
});
