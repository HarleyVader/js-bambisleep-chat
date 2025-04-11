import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import session from 'express-session';
import axios from 'axios';
import dotenv from 'dotenv';
import { promises as fsPromises } from 'fs';
import multer from 'multer';

// Routes
import scraperAPIRoutes from './routes/scraperRoutes.js';
import bambisRouter from './routes/bambis.js';
import bambiApiRouter from './routes/api/bambis.js';
import { setRoutes } from './routes/index.js';
import helpRoutes from './routes/help.js';
import scraperRoutes from './routes/scrapers.js';
import psychodelicTriggerManiaRoutes from './routes/psychodelic-trigger-mania.js';

// Middleware
import errorHandler from './middleware/errorHandler.js';
import performanceMiddleware from './middleware/performance.js';
import { userContextMiddleware } from './middleware/userContext.js';

// Config
import footerConfig from './config/footer.config.js';

// Worker Coordinator
import workerCoordinator from './workers/workerCoordinator.js';

// Database
import { databaseErrorHandler } from './database/databaseErrorHandler.js';

// Utilities
import Logger from './utils/logger.js';

// Schemas
import { Bambi } from './models/Bambi.js';

// Load env variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logger
const logger = new Logger('App');

// Create Express app
const app = express();

// Configure TTS API settings
const KOKORO_HOST = process.env.KOKORO_HOST || 'localhost';
const KOKORO_PORT = process.env.KOKORO_PORT || 8880;
const KOKORO_API_URL = process.env.KOKORO_API_URL || `http://${KOKORO_HOST}:${KOKORO_PORT}/v1`;
const KOKORO_DEFAULT_VOICE = process.env.KOKORO_DEFAULT_VOICE || 'af_sky';
const KOKORO_API_KEY = process.env.KOKORO_API_KEY || 'not-needed';

logger.info(`Kokoro TTS API configured with URL: ${KOKORO_API_URL}`);

// Setup basic middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://bambisleep.chat', 'https://fickdichselber.com']
    : true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  abortOnLimit: true
}));

app.use(performanceMiddleware);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware - define once, use everywhere
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'bambisleep-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
});

app.use(sessionMiddleware);

// Consolidated static file serving with proper paths
// Main public directory - solve path conflicts
app.use(express.static(path.join(__dirname, 'public')));

// Workers directory
app.use('/workers', express.static(path.join(__dirname, 'workers')));

// Images with dedicated route
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Dedicated CSS/JS routes with proper MIME types
app.use('/css', express.static(path.join(__dirname, 'public/css'), {
  setHeaders: (res) => res.setHeader('Content-Type', 'text/css')
}));

app.use('/js', express.static(path.join(__dirname, 'public/js'), {
  setHeaders: (res) => res.setHeader('Content-Type', 'application/javascript')
}));

app.use('/gif', express.static(path.join(__dirname, 'public/gif')));

// Bambi-specific assets (fixing path conflicts)
app.use('/bambis/css', express.static(path.join(__dirname, 'public/css'), {
  setHeaders: (res) => res.setHeader('Content-Type', 'text/css')
}));

app.use('/bambis/js', express.static(path.join(__dirname, 'public/js'), {
  setHeaders: (res) => res.setHeader('Content-Type', 'application/javascript')
}));

app.use('/bambis/gif', express.static(path.join(__dirname, 'public/gif')));

// Update the views configuration
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Set global template variables
app.locals.footer = footerConfig;

// Navigation links middleware
app.use((req, res, next) => {
  res.locals = res.locals || {};
  res.locals.bambisUrl = '/bambis';
  next();
});

// Apply user context middleware globally
app.use(userContextMiddleware);

// Route mounting - avoid duplication
// Main routes using the route setter
setRoutes(app);

// Mount specific route modules - no duplicates
app.use('/help', helpRoutes);
app.use('/scrapers', scraperRoutes);
app.use('/psychodelic-trigger-mania', psychodelicTriggerManiaRoutes);

// Add the correct route for bambi creation - this needs to be BEFORE the bambisRouter
app.get('/bambis/create', (req, res) => {
  res.render('bambis/creation', { 
    bambiname: req.cookies?.bambiname || req.session?.bambiname || ''
  });
});

app.use('/bambis', bambisRouter);

// API routes
app.use('/api/scraper', scraperAPIRoutes);
app.use('/api/bambis', bambiApiRouter);

// Home route
app.get('/', (req, res) => {
  const validConstantsCount = 9;
  res.render('index', { validConstantsCount: validConstantsCount });
});

// Worker coordination routes
app.post('/scrape', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  workerCoordinator.scrapeUrl(url, (error, results) => {
    if (error) {
      return res.status(500).json({ error: 'Error scraping content' });
    }
    res.json(results);
  });
});

app.post('/scan', (req, res) => {
  const { directory } = req.body;
  if (!directory) {
    return res.status(400).json({ error: 'Directory path is required' });
  }

  workerCoordinator.scanDirectory(directory, (error, results) => {
    if (error) {
      return res.status(500).json({ error: 'Error scanning directory' });
    }
    res.json(results);
  });
});

// TTS API endpoints
app.get('/api/tts/voices', async (req, res) => {
  try {
    const response = await axios({
      method: 'get',
      url: `${KOKORO_API_URL}/voices`,
      headers: {
        'Authorization': `Bearer ${KOKORO_API_KEY}`
      }
    });

    res.json(response.data);
  } catch (error) {
    logger.error(`Voice listing error: ${error.message}`);
    res.status(500).json({
      error: 'Error fetching voice list',
      details: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
});

app.get('/api/tts', async (req, res) => {
  const text = req.query.text;
  const voice = req.query.voice || KOKORO_DEFAULT_VOICE;

  if (typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'Invalid input: text must be a non-empty string' });
  }

  try {
    const response = await fetchTTSFromKokoro(text, voice);

    // Set appropriate headers
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', response.data.length);
    res.setHeader('Cache-Control', 'no-cache');

    // Send the audio data
    res.send(response.data);
  } catch (error) {
    logger.error(`TTS API Error: ${error.message}`);

    if (error.response) {
      const status = error.response.status;

      if (status === 401) {
        logger.error('Unauthorized access to Kokoro API - invalid API key');
        return res.status(401).json({ error: 'Unauthorized access' });
      } else {
        // For other error types
        const errorDetails = process.env.NODE_ENV === 'production' ? null : error.message;
        return res.status(status).json({
          error: 'Error generating speech',
          details: errorDetails
        });
      }
    }
    return res.status(500).json({
      error: 'Unexpected error in TTS service',
      details: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
});

// Bambis API routes
app.post('/api/bambis/set-bambiname', (req, res) => {
  const { bambiname } = req.body;
  
  if (!bambiname) {
    return res.status(400).json({ success: false, message: 'Bambi name is required' });
  }
  
  // Validate the bambiname (no special characters, reasonable length)
  const sanitizedName = bambiname.trim().substring(0, 30);
  if (sanitizedName !== bambiname) {
    return res.status(400).json({ 
      success: false, 
      message: 'Bambi name must be 30 characters or less with no leading/trailing spaces' 
    });
  }
  
  // Save the bambi name to the user's session
  if (req.session) {
    req.session.bambiname = bambiname;
    req.session.save();
  }
  
  // Set cookie on the response for clients without JS
  res.cookie('bambiname', bambiname, { 
    maxAge: 30*24*60*60*1000, // 30 days
    path: '/'
  });
  
  // Return success response
  res.json({ 
    success: true, 
    message: 'Bambi name set successfully', 
    username: bambiname 
  });
});

// Add an authentication status endpoint
app.get('/api/auth/status', (req, res) => {
  const bambiname = req.session?.bambiname || 
                   req.cookies?.bambiname ||
                   '';
                   
  // If we have a session but no cookie, set the cookie
  if (req.session?.bambiname && !req.cookies?.bambiname) {
    res.cookie('bambiname', req.session.bambiname, { 
      maxAge: 30*24*60*60*1000,
      path: '/'
    });
  }
  
  res.json({
    authenticated: !!bambiname,
    username: bambiname || null
  });
});

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(__dirname, 'public/uploads', file.fieldname === 'avatar' ? 'avatars' : 'headers');
    
    // Create directory if it doesn't exist
    fsPromises.mkdir(uploadDir, { recursive: true })
      .then(() => cb(null, uploadDir))
      .catch(err => cb(err));
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Create upload middleware
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Define route handler for bambi update
app.post('/bambis/update', upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'headerImage', maxCount: 1 }
]), (req, res) => {
  try {
    // Files are available in req.files
    const avatarFile = req.files.avatar ? req.files.avatar[0] : null;
    const headerFile = req.files.headerImage ? req.files.headerImage[0] : null;
    
    // Get other form data
    const { about, description, email, currentPassword, newPassword } = req.body;
    
    // Get username from session or cookie
    const username = req.session?.user?.username || 
                     decodeURIComponent(req.cookies['bambiname'] || '');
    
    if (!username) {
      return res.status(401).render('error', {
        error: { status: 401 },
        message: 'You must be logged in to update your profile',
        bambiname: ''
      });
    }
    
    // Prepare update object with only provided fields
    const updateData = {};
    if (about) updateData.about = about;
    if (description) updateData.description = description;
    if (email) updateData.email = email;
    
    // Add file paths if uploaded
    if (avatarFile) {
      updateData.bambiPictureUrl = `/uploads/avatars/${avatarFile.filename}`;
    }
    if (headerFile) {
      updateData.headerImageUrl = `/uploads/headers/${headerFile.filename}`;
    }
    
    // Update bambi in database
    Bambi.findOneAndUpdate(
      { username },
      { $set: { ...updateData, lastActive: new Date() } },
      { new: true, upsert: true }
    )
    .then(bambi => {
      res.redirect(`/bambis/${username}?updated=true`);
    })
    .catch(error => {
      logger.error('Error updating bambi:', error);
      res.status(500).render('error', {
        error: { status: 500 },
        message: 'Failed to update bambi profile',
        bambiname: username
      });
    });
  } catch (error) {
    logger.error('Error processing update:', error);
    res.status(500).render('error', { 
      error: { status: 500 },
      message: 'Failed to process update request',
      bambiname: req.cookies?.bambiname || ''
    });
  }
});

// TTS helper function
async function fetchTTSFromKokoro(text, voice = KOKORO_DEFAULT_VOICE, socketId = null) {
  try {
    const startTime = Date.now();
    logger.info(`[${socketId || 'no-socket'}]: "${text.substring(0, 45)}${text.length > 45 ? '...' : ''}"`);

    const requestData = {
      model: "kokoro",
      voice: voice,
      input: text,
      response_format: "mp3"
    };

    const response = await axios({
      method: 'post',
      url: `${KOKORO_API_URL}/audio/speech`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KOKORO_API_KEY}`
      },
      data: requestData,
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    // Calculate duration and append it to the log when complete
    const duration = Date.now() - startTime;
    if (duration > 500) {
      logger.info(`Fetching TTS from Kokoro completed in ${duration}ms`);
    }

    return response;
  } catch (error) {
    logger.error(`Error fetching TTS audio: ${error.message}`);
    throw error;
  }
}

// Function to load filtered words (for the server.js file)
export async function loadFilteredWords() {
  try {
    return JSON.parse(await fsPromises.readFile(path.join(__dirname, 'filteredWords.json'), 'utf8'));
  } catch (error) {
    logger.error('Error loading filtered words:', error);
    return [];
  }
}

// Initialize scrapers function
async function initializeScrapers() {
  const logger = new Logger('ScraperInit');
  logger.info('Initializing scrapers...');
  
  try {
    // You can put any scraper-specific initialization code here
    logger.success('Scrapers initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize scrapers:', error);
    throw error;
  }
}

// Function to initialize scrapers (for server.js)
export async function initializeScraperSystem() {
  return await initializeScrapers();
}

// Function to initialize worker coordinator (for server.js)
export async function initializeWorkerSystem() {
  return await workerCoordinator.initialize();
}

// Use database error handler middleware BEFORE other error handlers
app.use(databaseErrorHandler);
app.use(errorHandler);

// Export the configured app, session middleware and other necessary components
export { 
  app, 
  sessionMiddleware, 
  KOKORO_API_URL, 
  KOKORO_DEFAULT_VOICE, 
  KOKORO_API_KEY, 
  fetchTTSFromKokoro,
  workerCoordinator
};