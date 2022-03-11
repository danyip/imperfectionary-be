const express = require('express');
const app = express();
const http = require('http');
const socketIO = require('socket.io')

const server = http.Server(app)

const PORT = 9090;

server.listen(PORT, ()=>{
  console.log(`Server listening on http://localhost:${PORT}`);
})

const io = socketIO(server)

io.on('connection', (socket) => {
  console.log('io.on("connection")');

  socket.on('canvas-data', (data)=>{
    socket.broadcast.emit('canvas-data', data)
  })
})