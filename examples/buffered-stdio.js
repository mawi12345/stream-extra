'use strict';

var PassThrough = require('stream').PassThrough;
var Buffered = require('../lib/buffered');

var passThrough = new PassThrough();

var encoder = new Buffered(passThrough);
var decoder = new Buffered(passThrough);

decoder.pipe(process.stdout);
process.stdin.pipe(encoder);
