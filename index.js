
/**
 * Module dependencies.
 */

var uid2 = require('uid2');
var selftalk = require('selftalk').createClient;
var selftalkServer = require('selftalk').createServer;
var msgpack = require('msgpack-js');
var Adapter = require('socket.io-adapter');
var Emitter = require('events').EventEmitter;
var debug = require('debug')('socket.io-selftalk');
var async = require('async');

/**
 * Module exports.
 */

module.exports = adapter;

/**
 * Returns a selftalk Adapter class.
 *
 * @param {String} optional, selftalk uri
 * @return {SelftalkAdapter} adapter
 * @api public
 */

function adapter(uri, opts){
  opts = opts || {};

  // handle options only
  if ('object' == typeof uri) {
    opts = uri;
    uri = null;
  }

  // handle uri string
  if (uri) {
    uri = uri.split(':');
    opts.host = uri[0];
    opts.port = uri[1];
  }

  // opts
  var host = opts.host || '127.0.0.1';
  var port = Number(opts.port || 6378);
  var pub = opts.pubClient;
  var sub = opts.subClient;
  var prefix = opts.key || 'socket.io';

  var server = null;
  if (opts.server) {
    debug('launch selftalk server.')
    server = selftalkServer(port);
  }

  // init clients if needed
  if (!pub) pub = selftalk(port, host);
  if (!sub) sub = selftalk(port, host);

  // this server's key
  var uid = uid2(6);

  /**
   * Adapter constructor.
   *
   * @param {String} namespace name
   * @api public
   */

  function Selftalk(nsp){
    Adapter.call(this, nsp);

    this.uid = uid;
    this.prefix = prefix;
    this.pubClient = pub;
    this.subClient = sub;

    var self = this;
    sub.subscribe(prefix + '#' + nsp.name + '#', function(err){
      if (err) self.emit('error', err);
    });
    sub.on('message', this.onmessage.bind(this));
  }

  /**
   * Inherits from `Adapter`.
   */

  Selftalk.prototype.__proto__ = Adapter.prototype;

  /**
   * Called with a subscription message
   *
   * @api private
   */

  Selftalk.prototype.onmessage = function(channel, msg){
    // FIXME : there's no buffer type in json.
    var args = msgpack.decode(new Buffer(msg));
    var packet;

    if (uid == args.shift()) return debug('ignore same uid');

    packet = args[0];

    if (packet && packet.nsp === undefined) {
      packet.nsp = '/';
    }

    if (!packet || packet.nsp != this.nsp.name) {
      return debug('ignore different namespace');
    }

    args.push(true);

    this.broadcast.apply(this, args);
  };

  /**
   * Broadcasts a packet.
   *
   * @param {Object} packet to emit
   * @param {Object} options
   * @param {Boolean} whether the packet came from another node
   * @api public
   */

  Selftalk.prototype.broadcast = function(packet, opts, remote){
    Adapter.prototype.broadcast.call(this, packet, opts);
    if (!remote) {
      var chn = prefix + '#' + packet.nsp + '#';
      var msg = msgpack.encode([uid, packet, opts]);
      if (opts.rooms) {
        opts.rooms.forEach(function(room) {
          var chnRoom = chn + room + '#';
          pub.publish(chnRoom, msg);
        });
      } else {
        pub.publish(chn, msg);
      }
    }
  };

  /**
   * Subscribe client to room messages.
   *
   * @param {String} client id
   * @param {String} room
   * @param {Function} callback (optional)
   * @api public
   */

  Selftalk.prototype.add = function(id, room, fn){
    debug('adding %s to %s ', id, room);
    var self = this;
    Adapter.prototype.add.call(this, id, room);
    var channel = prefix + '#' + this.nsp.name + '#' + room + '#';
    sub.subscribe(channel, function(err){
      if (err) {
        self.emit('error', err);
        if (fn) fn(err);
        return;
      }
      if (fn) fn(null);
    });
  };

  /**
   * Unsubscribe client from room messages.
   *
   * @param {String} session id
   * @param {String} room id
   * @param {Function} callback (optional)
   * @api public
   */

  Selftalk.prototype.del = function(id, room, fn){
    debug('removing %s from %s', id, room);

    var self = this;
    var hasRoom = this.rooms.hasOwnProperty(room);
    Adapter.prototype.del.call(this, id, room);

    if (hasRoom && !this.rooms[room]) {
      var channel = prefix + '#' + this.nsp.name + '#' + room + '#';
      sub.unsubscribe(channel, function(err){
        if (err) {
          self.emit('error', err);
          if (fn) fn(err);
          return;
        }
        if (fn) fn(null);
      });
    } else {
      if (fn) process.nextTick(fn.bind(null, null));
    }
  };

  /**
   * Unsubscribe client completely.
   *
   * @param {String} client id
   * @param {Function} callback (optional)
   * @api public
   */

  Selftalk.prototype.delAll = function(id, fn){
    debug('removing %s from all rooms', id);

    var self = this;
    var rooms = this.sids[id];

    if (!rooms) {
      if (fn) process.nextTick(fn.bind(null, null));
      return;
    }

    async.forEach(Object.keys(rooms), function(room, next){
      self.del(id, room, next);
    }, function(err){
      if (err) {
        self.emit('error', err);
        if (fn) fn(err);
        return;
      }
      delete self.sids[id];
      if (fn) fn(null);
    });
  };

  Selftalk.uid = uid;
  Selftalk.pubClient = pub;
  Selftalk.subClient = sub;
  Selftalk.prefix = prefix;

  return Selftalk;

}
