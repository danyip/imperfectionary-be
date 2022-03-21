const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const User = require("./models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const jwtAuthenticate = require("express-jwt");
const dotenv = require("dotenv").config()
const mongoose = require("mongoose");

/*********************************************************************************/
// Setup server, socketIO and database connections
/*********************************************************************************/

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    orign: "*",
  },
});

const PORT = process.env.PORT || 9090;
httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection;
db.on("error", (err) => {
  console.log("Connection error", err);
  process.exit(1);
});

/*********************************************************************************/
// HTTP routes
/*********************************************************************************/

// Middleware   
app.use(cors()); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Login route
app.post("/login", async (req, res) => {
  console.log("POST /login", req.body);
  const { email, password } = req.body;

  try {
    // Lookup the user in the DB
    const user = await User.findOne({ email });
    
    // If the password matches
    if (user && bcrypt.compareSync(password, user.passwordDigest)) {

      // Generate a JWT
      const token = jwt.sign({ _id: user._id }, process.env.SERVER_SECRET_KEY, {
        expiresIn: "72h",
      });

      // Construct the currentUser object
      const currentUser = {username: user.username, email: user.email}

      // Send them to the FE
      res.json({ token, user: currentUser });

    } else {

      // If the password does not match, send back 401 - unauthorized and a message to display
      res.status(401).json({message: "Incorrect email or password"})
    }

  } catch (err) {
    console.log("Error querying User", err);
  }

});

// Signup route
app.post("/users/create", async (req, res) => {
  console.log("POST /users/create", req.body);

  // Construct the newUser object
  const newUser = {
    username: req.body.username,
    email: req.body.email,
    password_digest: bcrypt.hashSync(req.body.password, 10)
  };

  try {

    // Create the user in the DB
    const user = await User.create(newUser)
    console.log("Created new user: ", user);

    // Generate a JWT
    const token = jwt.sign({ _id: user._id }, process.env.SERVER_SECRET_KEY, {
      expiresIn: "72h",
    });

    // Construct the currentUser object
    const currentUser = {username: user.username, email: user.email}
    
    // Send then to the FE
    res.json({token, user: currentUser})

  } catch (err) {
    console.log('ERROR CREATING USER', err);

    // Send a status of 422 - unprocessable entitiy and return the error for display
    res.status(422).json(err)
  }
  
});

// Middleware to check authentication on follwoing routes 
const checkAuth = () => {
  return jwtAuthenticate({
    secret: process.env.SERVER_SECRET_KEY,
    algorithms: ["HS256"],
    requestProperty: "auth",
  });
};

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

// Update user route
app.post("/users/update", async (req, res) => {
  console.log("POST /users/update", req.body);

  try {

    // If there is no password
    if (req.body.password.length === 0) {

      // Just update the username and email
      const result = await User.findByIdAndUpdate(
        req.user._id,
        {
        username: req.body.username,
        email: req.body.email
        },
        {new: true}
      )
      
      // Construct the current user object
      const currentUser = {username: result.username, email: result.email}
      console.log('UPDATED: ', currentUser);
      
      // And return it
      res.json({user: currentUser})
      
    } else { // If there is a password

      // Update username, email and password
      const result = await User.findByIdAndUpdate(
        req.user._id,
        {
        username: req.body.username,
        email: req.body.email,
        passwordDigest: bcrypt.hashSync(req.body.password, 10)
        },
        {new: true}
      )

      // Construct the current user object
      const currentUser = {username: result.username, email: result.email}
      console.log('UPDATED: ', currentUser);

       // And return it
      res.json({user: currentUser})
    }
    
  } catch (err) {
    console.log('ERROR UPDATING USER', err);
    
    // Send a status of 422 - unprocessable entitiy and return the error for display
    res.status(422).json(err)
  }
  
});

/*********************************************************************************/
// Game State
/*********************************************************************************/

const game = {
  
  //roomName: {
  //  players: [],
  //  status: boolean,
  //  drawPlayer: '',
  //  word: '',
  // }

  // Add a user to a room
  addUser: function (room, username) {

    // if there is already a game with this room name and there is at least one player in the list
    if (room in this && this[room].players.length > 0) {
      // ignore a rejoin with the same name
      if (this[room].players.includes(username)) return; 

      // add the username to the players list
      this[room].players.push(username); 

    } else {

      // if there is not already a game with this name make one
      this.initializeRoom(room, username);
    }
  },

  // Remove a user from a room
  removeUser: function (room, username) {
    // Check the room exists
    if (room in this) {
      // Remove the players name from the player list
      this[room].players = this[room].players.filter(
        (name) => name !== username
      );
    }
  },

  // Initalize a room for a new game
  initializeRoom: function (room, username) {
    this[room] = {
      players: [username],
      drawPlayer: username,
      word: randomWord(),
    };
  },

};

// Helper function to return a randomly selected word
const randomWord = () => {
  // Array of possible words
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

  // Generate a random index
  const randomIndex = Math.floor(Math.random() * words.length);

  // Return the word at the random index
  return words[randomIndex];
};

/*********************************************************************************/
// Socket handlers
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

// Socket connection
io.on("connection", (socket) => {
  console.log("SOCKET CONNECTED", socket.username);

  // Socket renders the lobby
  socket.on("enter-lobby", () => {
    console.log("ENTER LOBBY", socket.username);
    
    // Create and array of all the available user defined room names
    const rooms = roomsArray(io.sockets.adapter.rooms);
    
    // Send all room names to lobby
    socket.emit("new-rooms", rooms);
  });

  // Socket joins/creates a room
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

    // Add username to game
    game.addUser(data, socket.username);

    // Emit the rooms list back to FE
    const rooms = roomsArray(io.sockets.adapter.rooms);
    io.emit("new-rooms", rooms);
  });

  // Socket renders game room
  socket.on("enter-game-room", (callback) => {
    console.log("ENTER GAME ROOM", socket.username);
    
    // If there is a room with this name and it contains players
    if (game[socket.roomName]?.players) {
      
      // Send back the game object for that room and the room name
      callback(game[socket.roomName], socket.roomName);
    
    } else {

      callback(null, "NO ROOM FOUND");
    
    }

    // Tell all the other sockts in the room to update their player list
    io.to(socket.roomName).emit(
      "update-player-list",
      game[socket.roomName]?.players
    );
  });

  // Socket sends a message
  socket.on("new-message", (messageObj) => {
    console.log("NEW MESSAGE", socket.username, messageObj);

    // Send the message to all other sockets in the room
    socket.to(socket.roomName).emit("message-data", messageObj);
    
    // Convert message and secret word to lowercase
    const message = messageObj.text.toLowerCase()
    const secret = game[socket.roomName].word.toLowerCase()
    
    // Check if the message contains the secret
    if (message.includes(secret)) {
      
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

  // Socket is drawing
  socket.on("canvas-data", (data) => {

    // Send the canvas to other sockets in the room
    socket.to(socket.roomName).emit("canvas-data", data);
  });

  // Socket clears the canvas
  socket.on("clear-canvas", ()=>{
    
    // Tell all the other sockets to clear the canvas too 
    socket.to(socket.roomName).emit("clear");
  })

  // Socket disonnnects
  socket.on("disconnect", (reason) => {
    console.log("SOCKET DISCONNECTED", socket.username);
    
    // Remove user from game
    game.removeUser(socket.roomName, socket.username);
    
    // Tell all the sockets in the room to update their player list
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


