var express = require('express');
var socketio = require('socket.io');

// Create base app and server
var app = express();
var server = require('http').createServer(app);
var io = socketio.listen(server);

var port = 3000;
var nicknames = [];

server.listen(port);

app.get('/', function (request, response) {
    response.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket) {
    socket.on('new user', function (data, callback) {
        // Don't allow already existing nicknames
        if (nicknames.indexOf(data) !== -1) {
            callback({isValid: false});
        } else {
            callback({isValid: true});
            socket.nickname = data;
            nicknames.push(data);
            updateNicknames(); // Emit updated user-list
        }
    });

    socket.on('send message', function (data) {
        io.sockets.emit('new message', { nickname: socket.nickname, msg: data }); // Send to everyone
        // socket.broadcast.emit('new message', data); // Everyone, except this socket
    });

    socket.on('disconnect', function (data) {
        if (!socket.nickname) {
            return;
        }

        nicknames.splice(nicknames.indexOf(socket.nickname), 1);
        updateNicknames();
    });

    var updateNicknames = function () {
        io.sockets.emit('usernames', nicknames);
    };
});