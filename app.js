var express = require('express');
var compression = require('compression');
var socket = require('socket.io');
var mongoose = require('mongoose');
var http = require('http');

// ## CONFIGS
var port = 3000;
var mongoHost = "localhost/socket-chat";


// ## Server setup
var app = express();
var server = http.createServer(app);
var io = socket.listen(server);
var users = {};

app.use(compression());

// Routes
app.get('/', function (request, response) {
    response.sendFile(__dirname + '/index.html');
});

// Serve lib files statically
app.use('/lib', express.static(__dirname + '/lib'));

// Catch-all route
app.all('*', function (request, response) {
    response.status(404).send('Where are you going?');
});

// ## MongoDB setup
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


// ## Socket.io setup
io.sockets.on('connection', function (socket) {

    // Handle new users
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

    // Handle messages
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

    // Delete users on disconnect
    socket.on('disconnect', function (data) {
        if (!socket.nickname) {
            return;
        }

        delete users[socket.nickname];
        updateNicknames();
    });

    /**
     * Emit updated list of usernames
     */
    var updateNicknames = function () {
        io.sockets.emit('usernames', Object.keys(users)); // Don't send the whole object, just the nick
    };
});

// Start listening
server.listen(process.env.PORT || port);