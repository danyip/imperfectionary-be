const express = require('express');
const {createServer} = require('http');
const {Server} = require('socket.io');

const app = express();
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    orign: '*'
  }
})

const PORT = 9090;

httpServer.listen(PORT, ()=>{
  console.log(`Server listening on http://localhost:${PORT}`);
})


io.on('connection', (socket) => {
  console.log('io.on("connection")');

  socket.on('canvas-data', (data)=>{
    socket.broadcast.emit('canvas-data', data)
  })
})