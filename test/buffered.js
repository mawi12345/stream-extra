/*global
  describe, it
*/

'use strict';

var assert = require('assert');
var BufferedWrapper = require('../lib/buffered');
var net = require('net');
var PassThrough = require('stream').PassThrough;
var port = 8323;
var EventEmitter = require('events').EventEmitter;
var noop = function() {
};

function spam(text, times) {
  if (!times) {
    times = 14;
  }

  for (var i = 0; i < times; i++) {
    text += text;
  }

  return text;
}

describe('BufferedWrapper', function() {

  it('should return a instance if the new keyword is omitted', function(done) {
    var stream = new PassThrough();
    var bufferedStream = BufferedWrapper(stream);
    assert(bufferedStream instanceof BufferedWrapper, 'is an instance of BufferedWrapper');
    done();
  });

  it('should ignore empty chunks', function(done) {
    var mock = new EventEmitter();
    mock.pause = noop;
    mock.resume = noop;
    mock.isPaused = function() {
      return false;
    };

    var bufferedStream = new BufferedWrapper(mock);
    bufferedStream.on('data', function() {
      assert(false, 'should not be called');
    });

    mock.emit('data', null);
    process.nextTick(done);
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

  it('should throw an error if the chunk is to big', function(done) {
    var bufferedStream = new BufferedWrapper(new PassThrough(), {lengthEncoding: 1});
    var msg = new Buffer(spam('.', 9));
    assert(msg.length > 256, 'length bigger then 1 byte');
    assert.throws(
      function() {
        bufferedStream.write(msg);
      },

      /out of bounds/
    );
    done();
  });

  it('should pass errors of the wrapped stream', function(done) {
    var stream = new PassThrough();
    var bufferedStream = new BufferedWrapper(stream);
    var err = new Error('for testing');

    bufferedStream.on('error', function(e) {
      assert.equal(e, err, 'the same error');
      done();
    });

    stream.emit('error', err);
  });

  it('should buffer incomplete chunks', function(done) {
    var serverMsg = new Buffer('#START#' + spam('Hello Client') + '#END#\r\n');
    var clientMsg = new Buffer('#START#' + spam('Hello Server!') + '#END#\r\n');

    var server = net.createServer(function(socket) { //'connection' listener
      var srv = new BufferedWrapper(socket, {lengthEncoding: 4});

      socket.on('data', function(buf) {
        assert(buf.length < clientMsg.length, 'tcp packet smaller than message');
      });

      srv.on('data', function(data) {
        assert.equal(data.toString(), clientMsg.toString(), 'got the whole message');
      });

      srv.on('end', function() {
        server.close(done);
      });

      srv.write(serverMsg);
    });

    server.listen(port, function() { //'listening' listener

      var socket = net.connect({port: port}, function() { //'connect' listener
        var client = new BufferedWrapper(socket, {lengthEncoding: 4});

        client.on('data', function(data) {
          assert.equal(data.toString(), serverMsg.toString(), 'got the whole message');
          client.end();
        });

        client.write(clientMsg);
      });

      socket.on('data', function(buf) {
        assert(buf.length < serverMsg.length, 'tcp packet smaller than message');
      });
    });
  });
});
