'use strict';
var Mux = require('../lib/mux');

// imitate a socket connection with an PassThrough stream.
var PassThrough = require('stream').PassThrough;
var passThrough = new PassThrough();
var server = new Mux(passThrough);
var client = new Mux(passThrough);

client.on('data', function(data) {
  console.log('client:  ' + data);
});

client.onceStream(2, function(stream) {
  console.log('got stream2');
  stream.on('data', function(data) {
    console.log('stream2: ' + data);
  });
});

client.onceStream(3, function(stream) {
  console.log('got stream3');
  stream.on('data', function(data) {
    console.log('stream3: ' + data);
  });
});

var stream2 = server.createStream(2);
var stream3 = server.createStream(3);

var count = 0;
var interval1;
var interval2;
var interval3;

var maybestop = function() {
  count++;
  if (count > 6) {
    clearInterval(interval1);
    clearInterval(interval2);
    clearInterval(interval3);
    client.end();
    stream2.end();
    stream3.end();
  }
};

interval1 = setInterval(function() {
  server.write('hello client');
  maybestop();
}, 500);

interval2 = setInterval(function() {
  stream2.write('hello stream 2');
  maybestop();
}, 700);

interval3 = setInterval(function() {
  stream3.write('hello stream 3');
  maybestop();
}, 900);
