# socket.io-selftalk


socket.io adapter implementation by using local pub/sub server.


## server
```javascript
var cluster = require('cluster');
var os = require('os');
var debug = require('debug')('server');

if (cluster.isMaster) {
  var server = require('http').createServer();
  var io = require('socket.io').listen(server);

  var selftalk = require('socket.io-selftalk');
  io.adapter(selftalk({ server : true, port: 6378 }));
  // var redis = require('socket.io-redis');
  // io.adapter(redis({ host: 'localhost', port: 6379 }));

  for (var i = 0; i < os.cpus().length; i++) {
    cluster.fork();
  }

  cluster.on('exit', function(worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died');
    cluster.fork();
  });
}

if (cluster.isWorker) {
  debug = require('debug')('worker');

  var express = require('express');
  var app = express();

  var http = require('http');
  var server = http.createServer(app);
  var io = require('socket.io').listen(server);

  var selftalk = require('socket.io-selftalk');
  io.adapter(selftalk({ port: 6378 }));
  // var redis = require('socket.io-redis');
  // io.adapter(redis({ host: 'localhost', port: 6379 }));

  io.on('connection', function(socket) {
    socket.emit('data', 'connected to worker: ' + cluster.worker.id);

    socket.on('data',function(data){
      debug(cluster.worker.id + ' : ' + data);
      io.emit('data', cluster.worker.id + ' : ' + data);
    })
  });

  server.listen(8000);
}
```

## client
```javascript
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
```

## run examples

```bash
$ DEBUG=* node examples/server.js
```

```bash
$ DEBUG=* node examples/client.js
```

# License
MIT
