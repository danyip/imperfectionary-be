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
const dotenv = require("dotenv").config()


const checkAuth = () => {
  return jwtAuthenticate({
    secret: process.env.SERVER_SECRET_KEY,
    algorithms: ["HS256"],
    requestProperty: "auth",
  });
};

const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI);

const db = mongoose.connection;

db.on("error", (err) => {
  console.log("Connection error", err);
  process.exit(1);
  // TODO: handle gracefully instead? Keep server running?
});

const PORT = process.env.PORT || 9090;

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

/*********************************************************************************/

app.post("/login", async (req, res) => {
  console.log("POST /login", req.body);
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user && bcrypt.compareSync(password, user.passwordDigest)) {
      const token = jwt.sign({ _id: user._id }, process.env.SERVER_SECRET_KEY, {
        expiresIn: "72h",
      });

      const currentUser = {username: user.username, email: user.email}

      res.json({ token, user: currentUser });
    } else {
      // res.sendStatus(401);
      res.status(401).json({message: "Incorrect email or password"})
      
    }
  } catch (err) {
    console.log("Error querying User", err);
  }

});

app.post("/users/create", async (req, res) => {
  console.log("POST /users/create", req.body);

  const newUser = {
    username: req.body.username,
    email: req.body.email,
    password_digest: bcrypt.hashSync(req.body.password, 10)
  };

  try {
    const user = await User.create(newUser)
    console.log(user);
    const token = jwt.sign({ _id: user._id }, process.env.SERVER_SECRET_KEY, {
      expiresIn: "72h",
    });

    const currentUser = {username: user.username, email: user.email}
    res.json({token, user: currentUser})

  } catch (err) {
    console.log('ERROR CREATING USER', err);
    // res.sendStatus(422)

    res.status(422).json(err)
  }
  
});

app.use( checkAuth() );

app.use( async (req, res, next) => {

  try {
    // use the req.auth object provided by the checkAuth() above to get the
    // logged-in user's ID and use it to look up the User object
    const user = await User.findOne({ _id: req.auth._id });
    
    if( user === null ){
      res.sendStatus( 401 ); // No user with that ID found (stale token?)
    } else {
      req.user = user;
      next(); // move on to next handler (i.e. actual specific route handler)
    }

  } catch( err ){
    console.log('Error querying user in auth middleware', err);
    res.sendStatus( 500 ); // prevents any further handlers from running
  }

});

app.post("/users/update", async (req, res) => {
  console.log("POST /users/update", req.body);


  try {

    if (req.body.password.length === 0) {
      const result = await User.findByIdAndUpdate(
        req.user._id,
        {
        username: req.body.username,
        email: req.body.email
        },
        {new: true}
      )
      
      const currentUser = {username: result.username, email: result.email}
      
      console.log('UPDATED: ', currentUser);
      res.json({user: currentUser})
      
    } else {

      const result = await User.findByIdAndUpdate(
        req.user._id,
        {
        username: req.body.username,
        email: req.body.email,
        passwordDigest: bcrypt.hashSync(req.body.password, 10)
        },
        {new: true}
      )
      
      const currentUser = {username: result.username, email: result.email}
      
      console.log('UPDATED: ', currentUser);
      res.json({user: currentUser})
    }
    
  } catch (err) {
    console.log('ERROR UPDATING USER', err);
    
    res.status(422).json(err)
  }
  
});

/*********************************************************************************/

const game = {
  //roomName: {
  //  players: [],
  //  status: boolean,
  //  drawPlayer: '',
  //  word: '',
  // }

  addUser: function (room, username) {
    // if there is already a game with this room name and there is at least one player in the list
    if (room in this && this[room].players.length > 0) {
      if (this[room].players.includes(username)) return; // ignore a rejoin with the same name
      this[room].players.push(username); // add the username to the players list
    } else {
      // if there is not already a game with this name make one
      this.initializeRoom(room, username);
    }
  },

  removeUser: function (room, username) {
    if (room in this) {
      this[room].players = this[room].players.filter(
        (name) => name !== username
      );
    }
  },

  initializeRoom: function (room, username) {
    this[room] = {
      players: [username],
      // started: false,
      drawPlayer: username,
      word: randomWord(),
    };
  },

  startGame: function (room, username) {
    // this[room].started = true;
    this[room].drawPlayer = username;
    this[room].word = randomWord()
  },
};

/*********************************************************************************/

// Middleware to authenticate socket connection
io.use((socket, next) => {
  // console.log("io.use()", socket.handshake.auth);
  if (socket.handshake.auth.token) {
    jwt.verify(
      socket.handshake.auth.token,
      process.env.SERVER_SECRET_KEY,
      async function (err, decoded) {
        if (err) return next(new Error("Authentication error"));

        try {
          const res = await User.findOne({ _id: decoded._id });
          socket.username = res.username;
        } catch (err) {
          console.log(err);
        }

        socket.decoded = decoded;

        next();
      }
    );
  } else {
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  console.log("SOCKET CONNECTED", socket.username);
  console.log("ROOMS", io.sockets.adapter.rooms);

  socket.on("enter-lobby", () => {
    // Send all room names to lobby
    console.log("ENTER LOBBY", socket.username);

    const rooms = roomsArray(io.sockets.adapter.rooms);
    // io.emit("new-rooms", rooms);
    socket.emit("new-rooms", rooms);
  });

  socket.on("join-room", (data) => {
    console.log("JOIN ROOM", socket.username, data);

    // Get the users list of rooms
    // console.log('JOIN-ROOM', data);
    const socketRooms = Array.from(socket.rooms.keys());

    // Find any old room that they are in
    const oldRoomName = socketRooms.find(
      (roomName) => !roomName.includes(socket.id)
    );

    // Leave the old room before joining a new room
    if (oldRoomName) {
      socket.leave(oldRoomName);
      game.removeUser(oldRoomName, socket.username);
      io.to(oldRoomName).emit("update-player-list", game[oldRoomName]?.players);
    }

    // Add the room name to the socket
    socket.roomName = data;

    // Join the new room
    socket.join(data);

    console.log("ROOMS", io.sockets.adapter.rooms);
    // Add username to game
    game.addUser(data, socket.username);

    // Emit the rooms list back to FE
    const rooms = roomsArray(io.sockets.adapter.rooms);
    io.emit("new-rooms", rooms);
  });

  socket.on("enter-game-room", (callback) => {
    console.log("ENTER GAME ROOM", socket.username);

    if (game[socket.roomName]?.players) {
      callback(game[socket.roomName], socket.roomName);
    } else {
      callback(null, "NO ROOM FOUND");
    }

    io.to(socket.roomName).emit(
      "update-player-list",
      game[socket.roomName]?.players
    );
  });

  socket.on("new-message", (messageObj) => {
    console.log("NEW MESSAGE", socket.username, messageObj);

    // Send the message to all other sockets in the room
    socket.to(socket.roomName).emit("message-data", messageObj);
    
    // Convert message and secret to lowercase
    const message = messageObj.text.toLowerCase()
    const secret = game[socket.roomName].word.toLowerCase()
    
    // Check if the message contains the secret
    if (message.includes(secret)) {
      console.log('FOUND IT!');
      
      // Send the username and the word 
      io.to(socket.roomName).emit("correct-guess", socket.username, game[socket.roomName].word);

      // Change word and drawPlayer
      game[socket.roomName].word = randomWord()
      game[socket.roomName].drawPlayer = socket.username

      // Wait 5 seconds then trigger the next round
      setTimeout(() => {
        io.to(socket.roomName).emit("clear");
        io.to(socket.roomName).emit("next-round", game[socket.roomName]);
      }, 5000);

    }

  });


  socket.on("canvas-data", (data) => {
    socket.to(socket.roomName).emit("canvas-data", data);
  });

  socket.on("clear-canvas", ()=>{
    socket.to(socket.roomName).emit("clear");
  })

  socket.on("disconnect", (reason) => {
    console.log("SOCKET DISCONNECTED", socket.username);
    // Remove user from game
    game.removeUser(socket.roomName, socket.username);
    io.to(socket.roomName).emit(
      "update-player-list",
      game[socket.roomName]?.players
    );
  });
});

// Helper function to process es6 Map
const roomsArray = (roomsMap) => {
  // convert es6 Map object of rooms into an array
  const arr = Array.from(roomsMap);

  // process the array to remove rooms that have a name matching the contained socket
  const filtered = arr.filter((room) => !room[1].has(room[0]));

  // return just the names of the remaining rooms (the rooms that are user generated)
  return filtered.map((i) => i[0]);
};

const randomWord = () => {
  const words = [
    "Elephant",
    "Ocean",
    "Book",
    "Egg",
    "House",
    "Dog",
    "Ball",
    "Star",
    "Shirt",
    "Ice cream",
    "Drum",
    "Christmas tree",
    "Spider",
    "Shoe",
    "Smile",
    "Hat",
    "Cookie",
    "Bird",
    "Kite",
    "Snowman",
    "Butterfly",
    "Cupcake",
    "Fish",
    "Grapes",
    "Socks",
    "TV",
    "Bed",
    "Phone",
    "Skateboard",
    "Airplane",
    "Nose",
    "Eyes",
    "Apple",
    "Sun",
    "Sandwich",
    "Cherry",
    "Bubble",
    "Moon",
    "Snow",
    "Person",
  ];

  const randomIndex = Math.floor(Math.random() * words.length);

  return words[randomIndex];
};
