'use strict';

// This example creates messages that get split on the tcp stream.
// the BufferedWrapper than buffers the messages and ensures the whole
// message is received as once.

var dgram = require('dgram');
var UDPWrapper = require('../lib/udp');

var serverPort = process.argv[2] || 8124;
var clientPort = 32932;

var socket = dgram.createSocket('udp4');
socket.bind(clientPort, function() {
  var stream = new UDPWrapper(socket, {
    address: '127.0.0.1',
    port: serverPort,
  });
  stream.pipe(process.stdout);
  process.stdin.pipe(stream);
});
