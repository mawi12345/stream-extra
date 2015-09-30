# stream-extra

The missing Duplex stream wrappers.

    npm install mawi12345/stream-extra

## Buffered

```javascript
var Buffered = require('stream-extra').Buffered
var bufferedSocket = new Buffered(socket, options);
```

Buffered ensures every chunk written to the stream is received exactly the same  on the receiving side. To overcome fragmentation every chunk is prefixed with an size header.

#### Example

```javascript
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

```javascript
{
  lengthEncoding: 2, // the size in bytes of the length header
                     // possible values: 1, 2 and 4
}
```

## Mux

```javascript
var Mux = require('stream-extra').Mux
var multiplexedStream = new Mux(socket, options);
```

The Mux wrapper adds the possibility of multiplexing the stream. To distinguish the multiplexed streams a additional `id` header is added to every chunk.

#### Example

```javascript
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
```

#### Options

```javascript
{
  lengthEncoding: 2, // the size in bytes of the length header
  idEncoding: 2,     // the size in bytes of the id header
                     // possible values for both options: 1, 2 and 4
}
```

## ZLib

## JSON

## RPC

## Cipher
