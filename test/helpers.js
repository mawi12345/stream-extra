'use strict';

var net = require('net');

exports.spam = function(text, times) {
  if (!times) {
    times = 14;
  }

  for (var i = 0; i < times; i++) {
    text += text;
  }

  return text;
};

exports.getFreePort = function(cb, start) {
  if (!start) {
    start = 45032;
  }

  var port = start + 1;
  var server = net.createServer();

  server.listen(port, function() {
    server.once('close', function() {
      cb(port);
    });

    server.close();
  });

  server.on('error', function() {
    exports.getFreePort(cb, port);
  });
};
