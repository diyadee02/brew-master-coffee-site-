const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));


// Mongoose setup
mongoose.connect('mongodb://localhost:27017/coffee_users', { useNewUrlParser: true, useUnifiedTopology: true });

// User schema/model
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  email: { type: String, unique: false },
  avatarUrl: String
});
const User = mongoose.model('User', userSchema);

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({ secret: 'coffeeSecret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// Passport config
passport.use(new LocalStrategy(
  async function(username, password, done) {
    try {
      const user = await User.findOne({ username: username });
      if (!user) return done(null, false, { message: 'Incorrect username.' });
      if (user.password !== password) return done(null, false, { message: 'Incorrect password.' });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Middleware to pass user info to all views
app.use((req, res, next) => {
  res.locals.user = req.isAuthenticated() ? req.user : null;
  next();
});

// Home route (always accessible)
app.get('/', (req, res) => {
  res.render('index');
});

// Login route
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login',
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/error?msg=Login%20failed'
  })
);

app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.redirect('/error?msg=User%20already%20exists');
    }
    const newUser = new User({ username, password });
    await newUser.save();
    res.redirect('/login');
  } catch (err) {
    res.redirect('/error?msg=Registration%20error');
  }
});

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

app.get('/error', (req, res) => {
  res.render('error', { message: req.query.msg || 'An error occurred.' });
});

// Protected route example
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/gallery', (req, res) => {
  res.render('gallery');
});

app.get('/about', (req, res) => {
  res.render('about');
});

app.get('/blog', (req, res) => {
  res.render('blogs');
});

app.get('/contact', (req, res) => {
  res.render('contact');
});

app.get('/menu', (req, res) => {
  res.render('menu');
});


// Multer storage config for avatars
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public', 'uploads'));
  },
  filename: function (req, file, cb) {
    // Use username or Date.now if req.user is not available
    const unique = (req.user && req.user._id) ? req.user._id : Date.now();
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Edit profile route (GET)
app.get('/settings', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  res.render('settings', { user: req.user });
});

// Edit profile route (POST, with avatar upload)
app.post('/settings', upload.single('avatar'), async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  const { username, password } = req.body;
  try {
    if (username) req.user.username = username;
    if (password) req.user.password = password;
    if (req.file) req.user.avatar = '/uploads/' + req.file.filename;
    await req.user.save();
    res.redirect('/settings');
  } catch (err) {
    res.redirect('/error?msg=Settings%20update%20failed');
  }
});

app.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  res.render('profile', { user: req.user });
});

app.post('/profile/update', upload.single('avatar'), async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  const { username, email } = req.body;
  try {
    if (username) req.user.username = username;
    if (email) req.user.email = email;
    if (req.file) req.user.avatarUrl = '/uploads/' + req.file.filename;
    await req.user.save();
    res.redirect('/profile');
  } catch (err) {
    res.redirect('/error?msg=Profile%20update%20failed');
  }
});

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});