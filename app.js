var express = require('express');
var socketio = require('socket.io');
var mongoose = require('mongoose');

// Create base app and server
var app = express();
var server = require('http').createServer(app);
var io = socketio.listen(server);

// # CONFIGS
var port = 3000;
var mongoHost = "localhost/socket-chat";
var amountOfOldMsgsLoaded = 10;

var users = {};

server.listen(port);

mongoose.connect('mongodb://' + mongoHost, function (err) {
    if (err) {
        console.error(err);
    } else {
        console.log('Connected to MongoDB succesfully!');
    }
});

// MongoDB Schema
var chatSchema = mongoose.Schema({
    nickname: String,
    msg: String,
    created_at: {type: Date, default: Date.now}
});

var Chat = mongoose.model('Message', chatSchema);

app.get('/', function (request, response) {
    response.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket) {
    var query = Chat.find({});
    query.sort('-created_at').limit(amountOfOldMsgsLoaded).exec(function (err, docs) {
        if (err) {
            throw err;
        }

        socket.emit('load old msgs', docs);
    });

    socket.on('new user', function (data, callback) {
        // Don't allow already existing nicknames
        if (data in users) {
            callback({isValid: false});
        } else {
            callback({isValid: true});
            socket.nickname = data;
            users[socket.nickname] = socket;
            updateNicknames(); // Emit updated user-list
        }
    });

    socket.on('send message', function (data, callback) {
        var msg = data.trim();

        // Check for whispers (direct message)
        if (msg.substring(0,3) === "/w ") {
            msg = msg.substring(3);
            var ind = msg.indexOf(' ');
            if (ind !== -1) {
                var name = msg.substring(0, ind);
                var msg = msg.substring(ind + 1);

                if (name in users) {
                    users[name].emit('whisper', {msg: msg, nickname: socket.nickname}); // Emit message only to wanted user

                    if (socket.nickname !== name) {
                        socket.emit('whisper', {msg: msg, nickname: socket.nickname}); // and to the sender
                    }
                } else {
                    callback('Error! Enter a valid user.');
                }

            } else {
                callback('Error! Please enter a message for your whisper.');
            }

        } else {
            var newMsg = new Chat({msg: msg, nickname: socket.nickname});
            newMsg.save(function (err) {
                if (err) {
                    throw err;
                } else {
                    io.sockets.emit('new message', {msg: msg, nickname: socket.nickname}); // Send to everyone
                }
            });
        }
    });

    socket.on('disconnect', function (data) {
        if (!socket.nickname) {
            return;
        }

        delete users[socket.nickname];
        updateNicknames();
    });

    var updateNicknames = function () {
        io.sockets.emit('usernames', Object.keys(users)); // Don't send the whole object, just the nick
    };
});