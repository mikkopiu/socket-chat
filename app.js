var express = require('express');
var socketio = require('socket.io');

// Create base app and server
var app = express();
var server = require('http').createServer(app);
var io = socketio.listen(server);

var port = 3000;

server.listen(port);

app.get('/', function (request, response) {
    response.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket) {
    socket.on('send message', function (data) {
        io.sockets.emit('new message', data); // Send to everyone
        // socket.broadcast.emit('new message', data); // Everyone, except this socket
    });
});