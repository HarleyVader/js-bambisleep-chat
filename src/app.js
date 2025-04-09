import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import session from 'express-session';
import axios from 'axios';
import dotenv from 'dotenv';
import { promises as fsPromises } from 'fs';

// Routes
import indexRoute from './routes/index.js';
import psychodelicTriggerManiaRouter from './routes/psychodelic-trigger-mania.js';
import helpRoute from './routes/help.js';
import scrapersRoute, { initializeScrapers } from './routes/scrapers.js';
import scraperAPIRoutes from './routes/scraperRoutes.js';
import bambisRouter from './routes/bambis.js';
import profilesRouter from './routes/profile.js';

// Middleware
import errorHandler from './middleware/errorHandler.js';
import { userContextMiddleware } from './middleware/userContext.js';
import { performanceMiddleware } from './middleware/performance.js';
import { databaseErrorHandler } from './middleware/databaseErrorHandler.js';

// Config
import footerConfig from './config/footer.config.js';

// Worker Coordinator
import workerCoordinator from './workers/workerCoordinator.js';

// Utilities
import Logger from './utils/logger.js';

// Schemas
import { Bambi, BambiSchema } from './models/Bambi.js';

// Database
import dbConnection from './database/index.js';

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
  origin: ['https://bambisleep.chat', 'https://fickdichselber.com'],
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
app.use(express.static(path.join(__dirname, 'public')));
app.use('/workers', express.static(path.join(__dirname, 'workers')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Update the views configuration
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.locals.footer = footerConfig;

// Session middleware
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'bambisleep-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
});

app.use(sessionMiddleware);

// Setup static assets
app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'node_modules/socket.io/client-dist/socket.io.js'));
});

// Profile assets
app.use('/profiles/css', express.static(path.join(__dirname, '../src/public/css')));
app.use('/profiles/js', express.static(path.join(__dirname, '../src/public/js')));
app.use('/profiles/gif', express.static(path.join(__dirname, '../src/public/gif')));

// Navigation links middleware
app.use((req, res, next) => {
  res.locals = res.locals || {};
  res.locals.profilesUrl = '/profiles';
  next();
});

// Apply profile app middleware
app.use('/profiles', sessionMiddleware, userContextMiddleware, profilesRouter);

// Define routes
const routes = [
  { path: '/', handler: indexRoute },
  { path: '/psychodelic-trigger-mania', handler: psychodelicTriggerManiaRouter },
  { path: '/help', handler: helpRoute },
  { path: '/scrapers', handler: scrapersRoute },
  { path: '/bambis', handler: bambisRouter },
  { path: '/profiles', handler: profilesRouter },
];

// Setup routes
routes.forEach(route => {
  app.use(route.path, route.handler);
});

// Define API routes
app.get('/', (req, res) => {
  const validConstantsCount = 9;
  res.render('index', { validConstantsCount: validConstantsCount });
});

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

// TTS helper function
async function fetchTTSFromKokoro(text, voice = KOKORO_DEFAULT_VOICE) {
  try {
    const startTime = Date.now();
    logger.info(`Fetching TTS from Kokoro: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

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

app.use('/api/scraper', scraperAPIRoutes);

// Handle profile updates
app.post('/bambis/update-profile', async (req, res) => {
  try {
    // Get username from session or cookie
    const username = req.session?.user?.username || 
                     decodeURIComponent(req.cookies['bambiname'] || '');
    
    if (!username) {
      return res.status(401).json({ 
          success: false, 
          message: 'You must be logged in to update your profile' 
      });
    }
    
    // Find and update the user's profile
    const bambi = await mongoose.model('Bambi').findOneAndUpdate(
        { username },
        { 
            $set: {
                about: req.body.about,
                description: req.body.description,
                profilePictureUrl: req.body.profilePictureUrl,
                headerImageUrl: req.body.headerImageUrl,
                lastActive: new Date()
            }
        },
        { new: true, upsert: true }
    );
    
    // Respond with success
    res.json({ 
        success: true, 
        message: 'Profile updated successfully',
        bambi
    });
    
  } catch (error) {
      logger.error('Profile update error:', error);
      res.status(500).json({ 
          success: false, 
          message: 'Server error occurred while updating profile' 
      });
  }
});

// Use database error handler middleware BEFORE other error handlers
app.use(databaseErrorHandler);
app.use(errorHandler);

// Function to load filtered words (for the server.js file)
export async function loadFilteredWords() {
  try {
    return JSON.parse(await fsPromises.readFile(path.join(__dirname, 'filteredWords.json'), 'utf8'));
  } catch (error) {
    logger.error('Error loading filtered words:', error);
    return [];
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

// Connect to database before starting server
try {
  await dbConnection.connect();
  
  // Start server only after successful database connection
  const server = app.listen(PORT, () => {
    logger.success(`Server running on port ${PORT}`);
  });
  
  // Add graceful shutdown handler
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await dbConnection.disconnect();
    server.close(() => {
      logger.info('Process terminated');
    });
  });
  
} catch (error) {
  logger.error(`Failed to start server: ${error.message}`);
  process.exit(1);
}

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