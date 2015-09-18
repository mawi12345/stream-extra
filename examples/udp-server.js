'use strict';

var dgram = require('dgram');
var udp = require('../lib/udp');
var repl = require('repl');

var listenPort = process.argv[2] || 8124;

var socket = dgram.createSocket('udp4');
socket.bind(listenPort, function() {
  udp.createServer(socket, function(stream, rinfo) {
    console.log('got new connection', rinfo);
    repl.start({
      prompt: 'Node.js via udp> ',
      input: stream,
      output: stream,
    });
  });

  console.log('listening on ' + listenPort);
});
