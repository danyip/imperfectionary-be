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
      res.json({ token, user });
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
});
