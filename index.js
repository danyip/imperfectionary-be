const express = require('express');
const {createServer} = require('http');
const {Server} = require('socket.io');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const jwtAuthenticate = require('express-jwt');





const app = express();
const httpServer = createServer(app)
const PORT = 9090;

const io = new Server(httpServer, {
  cors: {
    orign: '*'
  }
})


httpServer.listen(PORT, ()=>{
  console.log(`Server listening on http://localhost:${PORT}`);
})


io.on('connection', (socket) => {
  console.log('io.on("connection")', socket.id);

  socket.on('canvas-data', (data)=>{
    socket.broadcast.emit('canvas-data', data)
  })

})