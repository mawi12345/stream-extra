'use strict';

// This example creates messages that get split on the tcp stream.
// the BufferedWrapper than buffers the messages and ensures the whole
// message is received as once.

var net = require('net');
var BufferedWrapper = require('../lib/buffered');
var port = 8124;


function spam(text, times) {
  if (!times) {
    times = 14;
  }
  for (var i = 0; i < times; i++) {
    text += text;
  }
  return text;
}

var server = net.createServer(function(socket) { //'connection' listener
  console.log('client connected');
  var c = new BufferedWrapper(socket, {lengthEncoding: 4});
  c.on('data', function(data){
    console.log('server received '+ data.length+ ' from client');
  });

  c.on('end', function() {
    console.log('client disconnected');
    server.close();
  });
  var msg = new Buffer('#START#'+spam('Hello Client')+'#END#\r\n');
  console.log('server send '+msg.length+' bytes to client');
  c.write(msg);
});

server.listen(port, function() { //'listening' listener
  console.log('server bound');

  var client = new BufferedWrapper(net.connect({port: port}, function() { //'connect' listener
    console.log('connected to server!');
    var msg = new Buffer('#START#'+spam('Hello Server!')+'#END#\r\n');
    console.log('client send '+msg.length+' bytes to server');
    client.write(msg);
  }), {lengthEncoding: 4});
  client.on('data', function(data) {
    console.log('client received '+ data.length + ' from server');
  });
  client.on('end', function() {
    console.log('disconnected from server');
  });
  setTimeout(function(){
    client.end();
  }, 1000);
});
