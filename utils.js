var bcrypt = require('bcryptjs');
var ObjectId = require('mongojs').ObjectId;

var getNextSequence = function(db, name, cb) {
  db.findAndModify(
    {
      query: { _id: name },
      update: { $inc: { seq: 1 } },
      new: true,
      upsert: true
    }, function(err, record) {
      cb(record.seq);
    }
  );
}

exports.findStory = function(req, res, usersClient, client, cb) {
  client.findOne({
    _id: +req.params.id
  }, function(err, record) {
    if(record) {
      var user = usersClient.findOne({
        _id: record.user
      }, function(err, userRecord) {
        record.user = {
          _id: userRecord._id,
          username: userRecord.username
        };

        cb({
          success: true,
          record: record
        });
      });
    } else {
      cb({ success: false });
    }
  });
}

exports.createStory = function(req, res, counters, client, cb) {
  getNextSequence(counters, 'storyid', function(seq) {
    client.insert({
      _id: seq,
      hideIdentity: req.body.hideIdentity,
      user: req.user._id.valueOf(),
      entries: [
        {
          date: req.body.date,
          feeling: req.body.feeling,
          notes: req.body.notes          
        }
      ]
    }, function(err, record) {
      cb({
        success: true,
        record: record
      });
    });
  });
}

exports.createUser = function(req, res, client, cb) {
  var hash = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10));

  client.findOne({
    $or: [
      { username: req.body.username },
      { email: req.body.email }
    ]
  }, function(err, record) {
    if(record) {
      var error = "That username has been taken.";
      if(record.username === req.body.username) {
        error = "A user with that email address already exists.";
      }
      return cb({
        success: false,
        error: error
      });              
    }

    client.insert({
      username: req.body.username,
      email: req.body.email,
      password: hash
    }, function(err, record) {
      cb({
        success: true,
        record: record
      });
    });    
  });
}

exports.findUser = function(req, res, client, cb) {
  client.findOne({
    username: req.body.username
  }, function(err, record) {
    if(record) {
      if(bcrypt.compareSync(req.body.password, record.password)) {
        cb({
          success: true,
          record: record
        });        
      } else {
        cb({
          success: false,
          error: "Invalid password."
        });  
      }
    } else {
      cb({
        success: false,
        error: "Cannot find user with that username."
      });      
    }
  });
}