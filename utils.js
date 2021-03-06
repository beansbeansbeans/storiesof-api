var bcrypt = require('bcryptjs');
var ObjectId = require('mongojs').ObjectId;

var async = function(tasks, callback) {
  var count = 0, n = tasks.length;

  function complete() {
    count += 1;
    if (count === n) {
      callback();
    }
  }

  tasks.forEach(function (task) {
    task(complete);
  });
};

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

exports.likeStory = function(req, res, stories, users, cb) {
  stories.findAndModify({
    query: { _id: req.body.id },
    update: {
      $push: { likes: req.body.user_id }
    },
    new: true
  }, function(err, record) {
    if(err) {
      return cb({ success: false });
    }

    users.findAndModify({
      query: { _id: req.user._id.valueOf() },
      update: {
        $push: { likes: req.body.id }
      },
      new: true
    }, function(nestedErr, nestedRecord) {
      if(nestedErr) {
        return cb({ success: false });
      }

      cb({
        success: true,
        record: {
          story: record,
          user: nestedRecord
        }
      });      
    });
  });
}

exports.unlikeStory = function(req, res, stories, users, cb) {
  stories.findAndModify({
    query: { _id: req.body.id },
    update: {
      $pull: { likes: req.body.user_id }
    },
    new: true
  }, function(err, record) {
    if(err) {
      return cb({ success: false });
    }

    users.findAndModify({
      query: { _id: req.user._id.valueOf() },
      update: {
        $pull: { likes: req.body.id }
      },
      new: true
    }, function(nestedErr, nestedRecord) {
      if(nestedErr) {
        return cb({ success: false });
      }

      cb({
        success: true,
        record: {
          story: record,
          user: nestedRecord
        }
      });      
    });
  });
}

exports.findStory = function(req, res, client, cb) {
  client.findOne({
    _id: +req.params.id
  }, function(err, record) {
    if(record) {
      cb({
        success: true,
        record: record
      });
    } else {
      cb({ success: false });
    }
  });
}

exports.findStories = function(req, res, client, cb) {
  var pageSize = 30,
    page = +req.params.page;

  client.find().skip(pageSize * page).limit(pageSize).sort({ 'entries.0.date': -1 }).toArray(function(err, records) {
    if(records) {
      cb({ 
        success: true,
        records: records
      });
    } else {
      cb({ success: false });
    }
  });
}

exports.findSampleStory = function(req, res, client, cb) {
  client.findOne({
    'inflectionPoints.points': {
      $size: 3
    }
  }, function(err, record) {
    if(record) {
      cb({
        success: true,
        record: record
      });
    } else {
      cb({ success: false });
    }
  });
}

exports.findStoriesByPath = function(req, res, client, cb) {
  client.find({
    $or: [
      {
        $and: [
          {
            percentChange: {
              $lt: req.body.percentChange + 15
            }
          },
          {
            percentChange: {
              $gt: req.body.percentChange - 15
            }
          }
        ]        
      },
      {
        $and: [
          {
            'range.value': {
              $lt: req.body.range.value + 15
            }
          },
          {
            'range.value': {
              $gt: req.body.range.value - 15
            }
          }
        ]        
      }
    ],
    'inflectionPoints.points': {
      $size: req.body.inflectionPoints.points.length
    },
    'inflectionPoints.direction': req.body.inflectionPoints.direction
  }).toArray(function(err, records) {
    if(records.length) {
      cb({
        success: true,
        records: records
      });
    } else {
      client.find({
        'inflectionPoints.points': {
          $size: req.body.inflectionPoints.points.length
        },
        'inflectionPoints.direction': req.body.inflectionPoints.direction
      }).toArray(function(err, records) {
        if(records) {
          cb({
            success: true,
            records: records
          });
        } else {
          cb({ success: false });
        }
      });
    }
  });
}

exports.deleteStory = function(req, res, stories, users, cb) {
  async([
    function(done) {
      stories.remove({ _id: +req.body.id}, done)
    },
    function(done) {
      users.findAndModify({
        query: { _id: req.user._id.valueOf() },
        update: {
          $pull: { stories: +req.body.id }
        }
      }, done)      
    }
  ], function() { cb({ success: true }); });
}

exports.deleteEntry = function(req, res, client, cb) {
  client.findAndModify({
    query: { _id: req.body.id },
    update: {
      $set: { lastUpdated: Date.now() },
      $pull: {
        entries: { date: req.body.date }
      }
    },
    new: true
  }, function(err, record) {
    cb({ 
      success: true,
      record: record
    });
  });
}

exports.createStory = function(req, res, users, counters, client, cb) {
  getNextSequence(counters, 'storyid', function(seq) {

    users.findAndModify({
      query: { _id: req.user._id.valueOf() },
      update: {
        $push: { stories: seq }
      }
    }, function(err, userRecord) {
      client.insert({
        _id: seq,
        hideIdentity: req.body.hideIdentity,
        likes: [],
        user: {
          _id: userRecord._id,
          username: userRecord.username
        },
        lastUpdated: Date.now(),
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
  });
}

exports.editStoryVisibility = function(req, res, client, cb) {
  client.findAndModify({
    query: { _id: req.body.id },
    update: {
      $set: { 
        lastUpdated: Date.now(),
        hideIdentity: req.body.hideIdentity
      }
    },
    new: true
  }, function(err, record) {
    cb({
      success: true,
      record: record
    });
  });
}

exports.editStory = function(req, res, client, cb) {
  client.findAndModify({
    query: { _id: req.body.id },
    update: { 
      $set: { 
        lastUpdated: Date.now(),
        percentChange: req.body.percentChange,
        inflectionPoints: req.body.inflectionPoints,
        range: req.body.range
      },
      $push: { 
        entries: {
          $each: [
            {
              date: req.body.date,
              feeling: req.body.feeling,
              notes: req.body.notes              
            }
          ],
          $sort: { 'date': -1 }
        } 
      } 
    },
    new: true
  }, function(err, storyRecord) {
    cb({
      success: true,
      record: storyRecord
    });
  });
}

exports.getUser = function(req, res, usersClient, storiesClient, cb) {
  var stories = [], likes = [];

  usersClient.findOne({
    _id: req.user._id.valueOf()
  }, function(err, user) {
    async(user.likes.map(function(d) {
      return function(done) {
        storiesClient.findOne({ _id: d }, function(err, record) {
          if(record) { likes.push(record); }
          done();
        });
      }
    }).concat(user.stories.map(function(d) {
      return function(done) {
        storiesClient.findOne({ _id: d }, function(err, record) {
          if(record) { stories.push(record); }
          done();
        });
      }
    })), function() {
      cb({
        success: true,
        record: {
          stories: stories,
          likes: likes
        }
      });
    })
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
      var error = {
        field: 'email',
        message: "A user with that email address already exists."
      };
      if(record.username === req.body.username) {
        error = {
          field: 'username',
          message: "That username has been taken."
        };
      }

      return cb({
        success: false,
        error: error
      });              
    }

    client.insert({
      username: req.body.username,
      email: req.body.email,
      password: hash,
      likes: [],
      stories: []
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
    $or: [
      { username: req.body.username },
      { email: req.body.username }
    ]
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
          error: {
            field: 'password',
            message: 'Invalid password.'
          }
        });  
      }
    } else {
      cb({
        success: false,
        error: {
          field: 'username',
          message: "Sorry, we couldn't find anyone with that username or password."
        }
      });      
    }
  });
}