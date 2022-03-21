const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require("dotenv").config()
const User = require('./User');


mongoose.connect(process.env.MONGO_URI);

const db = mongoose.connection;

db.on('error', (err) => {
  console.log('Connection error', err);
});

db.once('open', async () => {

  console.log('Connected.');``

  await User.deleteMany({});

  console.log("does it make it here?");
  try {
    
    const users = await User.create([
      {
        username: 'dan',
        email: 'hello@danyip.com',
        passwordDigest: bcrypt.hashSync('chicken', 10),
      },
      {
        username: 'luke',
        email: 'luke@ga.co',
        passwordDigest: bcrypt.hashSync('chicken', 10),
      },
      {
        username: 'elmo',
        email: 'e@e.com',
        passwordDigest: bcrypt.hashSync('chicken', 10),
      },
      {
        username: 'testuser',
        email: 'u@u.com',
        passwordDigest: bcrypt.hashSync('chicken', 10),
      },
    ]);
    
    console.log('Created users:', users);
    process.exit(0)

  } catch (err) {
    console.log('Error creating Users!', err);
    process.exit(1)
  }


})