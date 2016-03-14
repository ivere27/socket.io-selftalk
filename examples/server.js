var cluster = require('cluster');
var os = require('os');
var debug = require('debug')('server');

if (cluster.isMaster) {
  var server = require('http').createServer();
  var io = require('socket.io').listen(server);

  var selftalk = require('../index.js');
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

  var selftalk = require('../index.js');
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