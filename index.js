const express = require("express");
const app = express();

const { createServer } = require("http");
const httpServer = createServer(app);

const cors = require("cors");
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { Server } = require("socket.io");
const io = new Server(httpServer, {
  cors: {
    orign: "*",
  },
});


const User = require("./models/User");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const jwtAuthenticate = require("express-jwt");
const dotenv = require("dotenv");
dotenv.config();

const checkAuth = () => {
  return jwtAuthenticate({
    secret: process.env.SERVER_SECRET_KEY,
    algorithms: ["HS256"],
    requestProperty: "auth",
  });
};

const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1/imperfectionary');

const db = mongoose.connection;

db.on('error', (err) => {
  console.log('Connection error', err);
  process.exit( 1 );
  // TODO: handle gracefully instead? Keep server running?
});

const PORT = 9090;

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

app.post("/login", async (req, res) => {
  console.log("POST /login", req.body);
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user && bcrypt.compareSync(password, user.passwordDigest)) {
      const token = jwt.sign({ _id: user._id }, process.env.SERVER_SECRET_KEY, {
        expiresIn: "72h",
      });
      res.json({ token, user: user._id });
    } else {
      res.sendStatus(401);
    }
  } catch (err) {
    console.log("Error querying User", err);
  }
});

io.on("connection", (socket) => {
  console.log('io.on("connection")', socket.id);

  socket.on("canvas-data", (data) => {
    socket.broadcast.emit("canvas-data", data);
  });

  // Send all room names to lobby
  socket.on('enter-lobby', () => {
      
      // Convert map of all rooms to an array
      const arr = Array.from(io.sockets.adapter.rooms);
      
      // Filter the array to remove private message rooms (rooms where the name is also contained in the list of connected sockets)
      const filtered = arr.filter(room => !room[1].has(room[0]))

      // Map the filtered array to return just the room names 
      const res = filtered.map(i => i[0]);
      
      // Send the array of user created room namescd
      io.emit("new-rooms", res);
  })

  // Join a socket to a room
  socket.on('join-room', (data)=>{
    
    // Get the users list of rooms
    const socketRooms = Array.from(socket.rooms.keys())

    // Find any old room that they are in
    const oldRoomName = socketRooms.find(roomName => !roomName.includes(socket.id))
    
    // Leave the old room before joining a new room
    if (oldRoomName){
      socket.leave(oldRoomName)
    }

    // Join the new room
    socket.join(data)


    const arr = Array.from(io.sockets.adapter.rooms);
    const filtered = arr.filter(room => !room[1].has(room[0]))
    const res = filtered.map(i => i[0]);
    
    io.emit("new-rooms", res);
  })

});

