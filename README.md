# stream-extra

The missing Duplex stream wrappers.

    npm install mawi12345/stream-extra

## Buffered

    var Buffered = require('stream-extra').Buffered
    var bufferedSocket = new Buffered(socket, options);

Buffered ensures every chunk written to the stream is received exactly the same  on the receiving side. To overcome fragmentation every chunk is prefixed with an size header.

#### Example

```
var Buffered = require('stream-extra').Buffered
var net = require('net');
var port = 8124;

// create big strings for fragmentation test.
function spam(text, times) {
  if (!times) { times = 12; }
  for (var i = 0; i < times; i++) { text += text; } return text;
}

var server = net.createServer(function(socket) { //'connection' listener
  console.log('client connected');

  // wrap the raw socket
  var bufferedStream = new Buffered(socket);

  bufferedStream.on('data', function(data) {
    console.log('server received ' + data.length + ' from client');
  });

  bufferedStream.on('end', function() {
    console.log('client disconnected');
    server.close();
  });

  var msg = new Buffer(spam('Hello Client'));
  console.log('server send ' + msg.length + ' bytes to client');
  bufferedStream.write(msg);
});

server.listen(port, function() {
  console.log('server is listening');

  // wrap the raw socket
  var bufferedStream = new Buffered(net.connect({port: port}, function() {
    console.log('connected to server!');
    var msg = new Buffer(spam('Hello Server!'));

    console.log('client send ' + msg.length + ' bytes to server');
    bufferedStream.write(msg);
  }));

  bufferedStream.on('data', function(data) {
    console.log('client received ' + data.length + ' from server');
    bufferedStream.end();
  });

  bufferedStream.on('end', function() {
    console.log('disconnected from server');
  });
});
```

#### Options

```
{
  lengthEncoding: 2, // the size in bytes of the length header
                     // possible values: 1, 2 und 4
}
```

## Mux

## ZLib

## JSON

## RPC

## Cipher
