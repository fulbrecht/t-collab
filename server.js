const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve the HTML file from the root directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'd3test.html'));
});

// Store the current state of the box
// Initial values match the client's calculation:
// svgWidth = 800, boxWidth = 120 => initialX = (800 - 120) / 2 = 340
// svgHeight = 600, boxHeight = 70 => initialY = (600 - 70) / 2 = 265
let currentBoxPosition = { x: 340, y: 265 };

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send the current box position to the newly connected client
    socket.emit('initialBoxPosition', currentBoxPosition);

    // Listen for box move events from clients
    socket.on('boxMoved', (newPosition) => {
        // Update the server's record of the box position
        currentBoxPosition = newPosition;
        // Broadcast the new position to all other clients
        socket.broadcast.emit('boxPositionUpdate', newPosition);
        // console.log(`Box moved to: ${JSON.stringify(newPosition)} by ${socket.id}`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
