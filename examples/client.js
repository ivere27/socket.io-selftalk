var crypto = require('crypto');
var socket = require('socket.io-client')('http://localhost:8000', {transports : ['websocket']});
var debug = require('debug')('client');

var id = crypto.pseudoRandomBytes(16).toString();
var t;

socket.on('connect', function(){
  console.log('connect');
  t = setInterval(function() {
    var l = Number('0x'+crypto.pseudoRandomBytes(1).toString('HEX'));
    l *= Number('0x'+crypto.pseudoRandomBytes(1).toString('HEX'));
    var data = crypto.pseudoRandomBytes(l).toString();
    //var data = crypto.pseudoRandomBytes(l).toString('HEX');

    debug('sending');
    debug(data);
    socket.emit('data', data);
  },100);
});
socket.on('event', function(data){
  console.log('event - ' + data);
});
socket.on('error', function(){
  console.log('error');
  clearInterval(t);
});
socket.on('disconnect', function(){
  console.log('disconnect');
  clearInterval(t);
});
socket.on('data', function(data){
  console.log('data');
  console.log(data);
});