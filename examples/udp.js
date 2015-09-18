'use strict';

// This example creates messages that get split on the tcp stream.
// the BufferedWrapper than buffers the messages and ensures the whole
// message is received as once.

var dgram = require('dgram');
var UDPWrapper = require('../lib/udp');

var listenPort = process.argv[2] || 8124;
var sendPort = process.argv[3] || 8125;

var socket = dgram.createSocket('udp4');
socket.bind(listenPort, function() {
  var stream = new UDPWrapper(socket, {
    address: '127.0.0.1',
    port: sendPort,
  });
  stream.pipe(process.stdout);
  var index = 0;
  setInterval(function() {
    stream.write('hello world ' + index + '\n');
    index++;
  }, 1000);

  console.log('listening on ' + listenPort + ' sending to ' + sendPort);
});
