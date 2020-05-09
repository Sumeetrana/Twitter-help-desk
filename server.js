require('dotenv').config();

var express = require('express');
var passport = require('passport');
var Strategy = require('passport-twitter').Strategy;
var axios = require('axios')
var Twit = require('twit')



var T = new Twit({
  consumer_key: 'w9jGr2H9ZFrgVtbL89UUjXrh2',
  consumer_secret: '0r3ieEhxP8U7l6P7BDvhRbnWnAf5a7gXWU41amYnll6aDukk8R',
  access_token: '1032135551783034880-DfCxmC1wRzisTR8sDYvZ102IKXqkfw',
  access_token_secret: 'y5E5thyqEMjgNjkY0FYLyqoqP98cPXa1PvAkX3djtukbv'
})

var trustProxy = false;
if (process.env.DYNO) {
  // Apps on heroku are behind a trusted proxy
  trustProxy = true;
}


passport.use(new Strategy({
    consumerKey: 'w9jGr2H9ZFrgVtbL89UUjXrh2',
    consumerSecret: '0r3ieEhxP8U7l6P7BDvhRbnWnAf5a7gXWU41amYnll6aDukk8R',
    callbackURL: '/oauth/callback',
    proxy: trustProxy
  },
  function(token, tokenSecret, profile, cb) {
    
    
    return cb(null, profile);
  }));



passport.serializeUser(function(user, cb) {
  cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});


// Create a new Express application.
var app = express();

// view engine to render EJS templates.
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.json())

app.use(require('morgan')('combined'));
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));
app.use(express.static(__dirname + '/public'))

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());


//////// DEFINE ROUTES /////////

// HOME ROUTE
app.get('/',
  function(req, res) {
    res.render('home', { user: req.user });
  });


// LOGIN ROUTE
app.get('/login',
  function(req, res){
    console.log('ENV');
    console.log(process.env);
    console.log('Headers:');
    console.log(req.headers)
    res.render('login');
  });

app.get('/login/twitter',
  passport.authenticate('twitter'));

app.get('/oauth/callback',
  passport.authenticate('twitter', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/tweets');
  });


// PROFILE ROUTE

app.get('/profile',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res){
    // console.log(req.user);
    
    res.render('profile', { user: req.user });
  });


// Global variable declared
var replies=[]


// TWEET ROUTES

app.get('/tweets',
  require('connect-ensure-login').ensureLoggedIn(),
  (req, res) => {
  
  T.get('search/tweets', { q: `%40${req.user.username}`}, function(err, data, response) {
    
    res.render('profile', {user: req.user, mentions: data.statuses, tweeted_user: {}, replies})
    
  })
})

app.get('/tweet/:twitter_id',require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  
  console.log("Main_user: ", req.user);
  
  T.get('search/tweets', { q: `%40${req.user.username}`}, function(err, item, response) {
    let tweeted_user = {};
    item.statuses.map(user => {
      
      if (user.id_str == req.params.twitter_id) {
        
        tweeted_user['name']= user.user.screen_name;
        tweeted_user['description']= user.user.description;
        tweeted_user['image']= user.user.profile_image_url_https;
        tweeted_user['followers']= user.user.followers_count;
        tweeted_user['following']= user.user.friends_count;
        tweeted_user['tweet'] = user.text;
        tweeted_user['id_str'] = user.id_str
      } 
    })
    
    T.get('search/tweets', { q: `to:${tweeted_user.name}`, since_id: req.params.twitter_id }, function(err, data, response) {
      console.log(data.statuses.length)
      replies = [];
      data.statuses.map(status => {
        if (status.in_reply_to_status_id_str === req.params.twitter_id) {
          replies.unshift(status);
        }
      })
      console.log("Replies: ", replies.length);
      // console.log(replies);
      res.render('profile', {user: req.user, mentions: item.statuses, tweeted_user, replies})
    })

    
  })
})

app.post('/tweet/:tweet_id', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  // console.log("Main_User: ", req.user);
  
  T.get('statuses/show/:id', { id: `${req.params.tweet_id}` }, function(err, status, response) {
    
    T.post('statuses/update', {status: `${req.body.reply} @${status.user.screen_name}`,
     in_reply_to_status_id: [req.params.tweet_id],
     
    },
     
     function (err, data, response) {
      console.log(data);
      res.redirect(`/tweet/${req.params.tweet_id}`)

      
    });  
  })

  
})



// LOGOUT ROUTE

app.get('/logout',
  function(req, res){
    replies=[];
    req.session.destroy(function (err) {
      res.redirect('/');
    });
  });

app.listen(process.env['PORT'] || 8080);