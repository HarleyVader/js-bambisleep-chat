import express from 'express';
import session from 'express-session';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import path from 'path';
import { fileURLToPath } from 'url';
import { userContextMiddleware } from './userContext.js';
import { performanceMiddleware } from './performance.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

export function setupMiddleware(app) {
  // Basic middleware
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
  
  // Static files
  app.use(express.static(path.join(__dirname, '../../public')));
  app.use('/workers', express.static(path.join(__dirname, '../../workers')));
  app.use('/images', express.static(path.join(__dirname, '../../public/images')));
  
  // Profiles static files - now in one place
  app.use('/profiles/css', express.static(path.join(__dirname, '../../bambisleep-profile/src/public/css')));
  app.use('/profiles/js', express.static(path.join(__dirname, '../../bambisleep-profile/src/public/js')));
  app.use('/profiles/gif', express.static(path.join(__dirname, '../../bambisleep-profile/src/public/gif')));
  
  // View engine
  app.set('view engine', 'ejs');
  app.set('views', [
    path.join(__dirname, '../../src/views'),
    path.join(__dirname, '../../bambisleep-profile/src/views')
  ]);
  
  // Session middleware - shared across all routes
  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'bambisleep-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
  });
  
  app.use(sessionMiddleware);
  app.use(userContextMiddleware);
  
  // Inject common template variables
  app.use((req, res, next) => {
    res.locals = res.locals || {};
    res.locals.profilesUrl = '/profiles';
    next();
  });
}