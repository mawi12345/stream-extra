/*global
  describe, it
*/

'use strict';

var bufferedTestFactory = require('./spec/buffered');
var MuxWrapper = require('../lib/mux');
var assert = require('assert');
var PassThrough = require('stream').PassThrough;

describe('MuxWrapper', function() {

  // as mux is also buffered it should pass all buffered tests.
  bufferedTestFactory(MuxWrapper, function(source, options) {
    return new MuxWrapper(source, options);
  });

  it('should provide multiple streams', function(done) {
    var passThrough = new PassThrough();

    var mux1 = new MuxWrapper(passThrough);
    var mux2 = new MuxWrapper(passThrough);

    var testMsg = new Buffer('hello world!');
    var testMsg2 = new Buffer('hello world!!!!!!!');

    var mux1s6 = mux1.createStream(6);
    var mux2s6 = mux2.createStream(6);
    var assertations = 0;

    var endTest = function() {
      if (assertations === 4) {
        done();
      }
    };

    // use substream 6
    mux2s6.on('data', function(chunk) {
      assert.equal(chunk.toString(), testMsg.toString());
      assertations++;
    });

    mux2s6.on('end', function() {
      assertations++;
      endTest();
    });

    mux2.on('data', function(chunk) {
      assert.equal(chunk.toString(), testMsg2.toString());
      assertations++;
    });

    mux2.on('end', function() {
      assertations++;
      endTest();
    });

    mux1s6.write(testMsg);
    mux1.write(testMsg2);

    mux1s6.end();
    mux1.end();
  });

  it('should provide a onceStream callback', function(done) {
    var passThrough = new PassThrough();

    var mux1 = new MuxWrapper(passThrough);
    var mux2 = new MuxWrapper(passThrough);

    var id = mux1.freeId();

    var testMsg = new Buffer('hello world!');
    var testMsg2 = new Buffer('hello world!!!!!!!');

    var muxed1 = mux1.createStream(id);
    var assertations = 0;
    var endTest = function() {
      if (assertations === 5) {
        done();
      }
    };

    mux2.onceStream(id, function(muxed2) {
      assertations++;

      muxed2.on('data', function(chunk) {
        assert.equal(chunk.toString(), testMsg.toString());
        assertations++;
      });

      muxed2.on('end', function() {
        assertations++;
        endTest();
      });
    });

    mux2.on('data', function(chunk) {
      assert.equal(chunk.toString(), testMsg2.toString());
      assertations++;
    });

    mux2.on('end', function() {
      assertations++;
      endTest();
    });

    muxed1.write(testMsg);
    mux1.write(testMsg2);

    muxed1.end();
    mux1.end();
  });
});
