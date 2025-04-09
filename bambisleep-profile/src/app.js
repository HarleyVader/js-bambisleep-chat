import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import logger from './utils/logger.js';
import { getMongoConnection } from '../../src/utils/dbConnection.js';
import eventBus from '../../src/utils/eventBus.js';
import { Bambi } from '../../src/models/index.js';

// Load env vars
dotenv.config();

// Set up Express app
const app = express();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Serve static files with proper MIME types
app.use('/css', express.static(path.join(__dirname, 'public/css'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

app.use('/js', express.static(path.join(__dirname, 'public/js'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Setup other static assets
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/gif', express.static(path.join(__dirname, 'public/gif')));
app.use(express.static(path.join(__dirname, 'public')));

// Add redirects for backwards compatibility with existing file references
app.get('/gif/default-header.jpg', (req, res) => {
  res.redirect('/gif/default-header.gif');
});

// Redirect bambis route to profile page
app.get('/bambis', (req, res) => {
  res.redirect('/');
});

// Footer data for the template
const footerData = {
  logo: {
    url: '/',
    image: '/images/logo.png',
    alt: 'BambiSleep.Chat'
  },
  tagline: 'Customize your bambi experience',
  primaryLinks: [
    { label: 'Profiles', url: '/profiles' },
    { label: 'Settings', url: '/settings' },
    { label: 'Triggers', url: '/triggers' },
  ],
  secondaryLinks: [
    { label: 'Home', url: '/' },
    { label: 'About', url: '/about' },
    { label: 'Privacy', url: '/privacy' },
  ],
  tertiaryLinks: [
    { label: 'Discord', url: 'https://discord.gg/bambisleep', external: true },
    { label: 'Forum', url: '/forum' },
    { label: 'Share', url: '/share' },
  ],
  quaternaryLinks: [
    { label: 'Melkanea', url: 'https://www.youtube.com/@Melkanea', external: true },
    { label: 'Contributors', url: '/contributors' },
    { label: 'Support', url: '/support' },
  ]
};

// Make footer data available to all templates
app.use((req, res, next) => {
  res.locals.footer = footerData;
  next();
});

// Establish MongoDB connection
const db = getMongoConnection();

// Import routes
import indexRouter from './routes/index.js';
import profileRouter from './routes/profile.js';

// Use routes
app.use('/', indexRouter);
app.use('/profile', profileRouter);

// Listen for events from the main app
function setupProfileEventListeners() {
  // Listen for profile updates from the main app
  eventBus.on('profile:updated', ({ username, profile }) => {
    // Update profile UI if needed
    profileIo.emit('profile:updated', { username, profile });
  });
  
  // Listen for main app user login/logout
  eventBus.on('user:login', (userData) => {
    // Update profile app state when users log in
    profileIo.emit('user:login', userData);
  });
}

// Emit events from the profile app
profileRouter.post('/update', async (req, res) => {
  try {
    // Process update...
    
    // Notify main app about the update
    eventBus.emit('profile:updated', {
      username: req.body.username,
      profile: updatedProfile
    });
    
    res.json({ success: true });
  } catch (error) {
    // Error handling...
  }
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).render('error', {
    message: 'Page not found',
    error: { status: 404 },
    validConstantsCount: 5,
    title: 'Error - Page Not Found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message}`);
  res.status(err.status || 500).render('error', {
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {},
    validConstantsCount: 5,
    title: 'Error'
  });
});

export default app;