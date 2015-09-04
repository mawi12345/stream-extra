/*global
  it
*/

'use strict';

var assert = require('assert');
var net = require('net');
var PassThrough = require('stream').PassThrough;
var EventEmitter = require('events').EventEmitter;
var spam = require('../helpers').spam;
var getFreePort = require('../helpers').getFreePort;
var bigChunk = require('crypto').pseudoRandomBytes(65536 + 1024);
var noop = function() {
};

module.exports = function(Wrap, factory) {

  it('should return a instance if the new keyword is omitted', function(done) {
    var stream = new PassThrough();
    var bufferedStream = Wrap(stream);
    assert(bufferedStream instanceof Wrap, 'is an instance of BufferedWrapper');
    done();
  });

  it('should ignore empty chunks', function(done) {
    var mock = new EventEmitter();
    mock.pause = noop;
    mock.resume = noop;
    mock.isPaused = function() {
      return false;
    };

    var bufferedStream = factory(mock);
    bufferedStream.on('data', function() {
      assert(false, 'should not be called');
    });

    mock.emit('data', null);
    process.nextTick(done);
  });

  it('should throw an error if the chunk is to big', function(done) {
    var bufferedStream = factory(new PassThrough());
    assert(bigChunk.length > 65536, 'length bigger then 2 byte');

    var errorFound = false;
    bufferedStream.on('error', function(err) {
      if (!errorFound) {
        if (err.message.match(/out of bounds/)) {
          errorFound = true;
          done();
        }
      }
    });

    bufferedStream.write(bigChunk);
  });

  it('should pass errors of the wrapped stream', function(done) {
    var stream = new PassThrough();
    var bufferedStream = factory(stream);
    var err = new Error('for testing');

    bufferedStream.on('error', function(e) {
      assert.equal(e, err, 'the same error');
      done();
    });

    stream.emit('error', err);
  });

  it('should buffer incomplete chunks', function(done) {
    getFreePort(function(port) {
      var serverMsg = new Buffer('#START#' + spam('Hello Client') + '#END#\r\n');
      var clientMsg = new Buffer('#START#' + spam('Hello Server!') + '#END#\r\n');

      var server = net.createServer(function(socket) { //'connection' listener
        var srv = factory(socket, {lengthEncoding: 4});

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
          var client = factory(socket, {lengthEncoding: 4});

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
};
