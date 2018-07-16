//No need to set to a variable. We just want this code to run.
require('./config/config');

const express = require('express');
const bodyParser = require('body-parser');
const {ObjectId} = require('mongodb');

//Loading in mongoose here is all we need to do.
//The reason .save() works on line 22.
const mongoose = require('./db/mongoose');
const {User} = require('./models/user');
const {ToDo} = require('./models/todo');
const {authenticate} = require('./middleware/authenticate');

//This file will only be used to configure routes.
const app = express();
const port = process.env.PORT;
//Setting up third-party middleware.
//We are "giving" this functionality to express.
app.use(bodyParser.json());

//Here we set up a route for receiving incoming data from the client.
//We'll take this data, push it to the DB, and return an object to the client.
app.post('/todos', (req, res) => {
//This will log the parsed JSON data from the client, thanks to bodyParser.
  let toDo = new ToDo({text: req.body.text});
  toDo.save().then((doc)=>{
    res.send(doc);
  }, (err)=>{
  //400 signifies a Bad Request.
    res.status(400).send(err);
  });
});

app.get('/todos', (req, res) => {
  ToDo.find().then((todos)=>{
    //Wrap the array of objects in an object for future flexibility.
    res.send({msg: 'Notes successfully retrieved', todos});
  }, (err)=> {
    res.status(400).send(err);
  });
});

//URL params! String together multiple params with &.
// app.get('/todos/:fruit&:friend', (req, res) => {
//   res.send(req.params);
// });

//Some cool experimentation here with ternary op. It works!
app.get('/todos/:id', (req, res) => {
  let id = req.params.id;
  !ObjectId.isValid(id) ? res.status(400).send({errorMessage: 'Invalid ID.'}) :
  ToDo.findById(id).then((todo) => {
    !todo ? res.status(404).send({errorMessage: 'Unable to find todo by that ID.'}) :
    res.send({message: 'Todo located', todo});
  }).catch((err)=> {
    res.status(404).send(err);
  });
});

//Add a DELETE / route.
app.delete('/todos/:id', (req, res) => {
  let id = req.params.id;
  !ObjectId.isValid(id) ? res.status(400).send({errorMessage: 'Invalid ID.'}) :
  ToDo.findByIdAndRemove(id).then((todo) => {
    !todo ? res.status(404).send({errorMessage: 'Unable to find todo by that ID.'}) :
    res.send({message: 'Todo deleted', todo});
  }).catch((err)=> {
    res.status(404).send(err);
  });
});

app.patch('/todos/:id', (req, res) => {
  let id = req.params.id;

  if (!ObjectId.isValid(id)) {
    //Above in ternary op, return is implied with each case of res.send().
    return res.status(400).send({errorMessage: 'Invalid ID.'});
  }
  //Instead of using lodash, just for fun.
  function updateSpecs (req) {
    let body = {};
    if (typeof req.body.text === 'string' && req.body.text.trim().length >= 1) {
      body.text = req.body.text;
    }
    //Completed prop only set if true or false.
    if (req.body.completed === true) {
      body.completed = true;
      body.completedAt = new Date().getTime();
    } else if (req.body.completed === false) {
      body.completed = false;
      body.completedAt = null;
    }
    return body;
  }

  let body = updateSpecs(req);

  if (Object.keys(body).length < 1) {
    return res.status(400).send({errorMessage: 'Please specify text update (string) and/or valid completion status (boolean).'});
  }

  ToDo.findByIdAndUpdate(id, {
    //Should work since body is an obj.
    $set: body
  }, {
    new: true
  }).then((todo) => {
    !todo ? res.status(404).send({errorMessage: 'Unable to find and update note.'}) :
    res.send({message: 'Updated todo', todo});
  }).catch((err) => {
    res.status(404).send(err);
  });
});

app.post('/users', (req, res) => {
  let newUser = new User({
    email: req.body.email,
    password: req.body.password
  });

//Will return the user doc.
  newUser.save().then(() => {
    //We use this return so we can chain the next then to the then before, not to the function call.
    //In other words, we avoid complicated nesting.
    //This function returns a Promise, so here we return that Promise in the main chain.
    return newUser.generateAuthToken();
  }).then((token) => {
    //Since the user is here sent as JSON, our overridden toJSON method kicks in.
    res.header('x-auth', token).send({message: 'New user saved.', user: newUser});
  }).catch((err)=>{
    //Had to change to double equals since 11000 technically a string.
    err.code == 11000 ? res.status(400).send({errorMessage: 'A profile with this email address already exists.'}) :
    res.status(400).send({errorMessage: err.message});
  });
});

//First private route, thanks to authenticate. 
app.get('/users/me', authenticate, (req, res) => {
  //Thanks to the middleware, our req has been modified.
  res.send(req.user);
});

app.listen(port, () => {
  console.log(`Server started on ${port}.`);
});

module.exports = {app};
