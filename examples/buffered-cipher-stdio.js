'use strict';

var PassThrough = require('stream').PassThrough;
var Buffered = require('../lib/buffered');
var BufferedCipherWrapper = require('../lib/buffered/cipher');
var crypto = require('crypto');

var passThrough = new PassThrough();

crypto.randomBytes(40, function(err, buf) {
  var options = {
    key: buf.slice(0, 24),
    algorithm: 'AES-192-CBC',
    iv: buf.slice(24, 40),
  };

  console.log('algorithm: ' + options.algorithm);
  console.log('key: ' + options.key.toString('hex'));
  console.log('iv: ' + options.iv.toString('hex'));

  var encoder = new BufferedCipherWrapper(new Buffered(passThrough), options);
  var bufferedDecode = new Buffered(passThrough);
  var decoder = new BufferedCipherWrapper(bufferedDecode, options);
  bufferedDecode.on('data', function(data) {
    console.log('ciphered data: ' + data.toString('hex'));
  });

  decoder.pipe(process.stdout);
  process.stdin.pipe(encoder);
});
