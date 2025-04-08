// src/utils/config.js
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Logger from './logger.js';

const logger = new Logger('Config');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config();

// Define required environment variables and their validators
const envVars = {
  // Server
  SERVER_PORT: {
    type: 'number',
    default: 6969,
    validator: (val) => val > 0 && val < 65536
  },
  NODE_ENV: {
    type: 'string',
    default: 'development',
    validator: (val) => ['development', 'production', 'test'].includes(val)
  },
  
  // Database
  MONGODB_URI: {
    type: 'string',
    required: true,
    validator: (val) => val.startsWith('mongodb://') || val.startsWith('mongodb+srv://')
  },
  
  // LMS Settings
  LMS_HOST: {
    type: 'string',
    required: true,
    validator: (val) => val.length > 0
  },
  LMS_PORT: {
    type: 'number',
    required: true,
    validator: (val) => val > 0 && val < 65536
  },
  
  // Speech Settings
  SPEECH_HOST: {
    type: 'string',
    required: true,
    validator: (val) => val.length > 0
  },
  SPEECH_PORT: {
    type: 'number',
    required: true,
    validator: (val) => val > 0 && val < 65536
  },
  
  // JWT Auth
  JWT_SECRET: {
    type: 'string',
    required: true,
    validator: (val) => val.length >= 32
  },
  JWT_EXPIRES_IN: {
    type: 'string',
    default: '7d',
    validator: (val) => /^\d+[smhdy]$/.test(val)
  },
  
  // Session
  SESSION_SECRET: {
    type: 'string',
    required: true,
    validator: (val) => val.length >= 32
  },
  
  // Worker Pool
  WORKER_POOL_SIZE: {
    type: 'number',
    default: 0, // 0 means use CPU count - 1
    validator: (val) => val >= 0
  },
  WORKER_MEMORY_LIMIT_MB: {
    type: 'number',
    default: 500,
    validator: (val) => val > 0
  },
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: {
    type: 'number',
    default: 60000, // 1 minute
    validator: (val) => val > 0
  },
  RATE_LIMIT_MAX_REQUESTS: {
    type: 'number',
    default: 100,
    validator: (val) => val > 0
  },
  SOCKET_RATE_LIMIT_POINTS: {
    type: 'number',
    default: 50,
    validator: (val) => val > 0
  },
  SOCKET_RATE_LIMIT_DURATION: {
    type: 'number',
    default: 60, // 60 seconds
    validator: (val) => val > 0
  }
};

// Process environment variables
function processEnvVars() {
  const config = {};
  const errors = [];
  
  for (const [key, settings] of Object.entries(envVars)) {
    let value = process.env[key];
    
    // Check if variable is missing but required
    if (settings.required && (value === undefined || value === '')) {
      errors.push(`Required environment variable ${key} is missing`);
      continue;
    }
    
    // Use default value if not provided
    if ((value === undefined || value === '') && 'default' in settings) {
      value = settings.default;
    }
    
    // Skip if no value and not required
    if (value === undefined || value === '') {
      continue;
    }
    
    // Convert to correct type
    if (settings.type === 'number') {
      value = Number(value);
    } else if (settings.type === 'boolean') {
      value = String(value).toLowerCase() === 'true';
    }
    
    // Validate
    if (settings.validator && !settings.validator(value)) {
      errors.push(`Environment variable ${key} failed validation`);
      continue;
    }
    
    config[key] = value;
  }
  
  // Exit if there are errors
  if (errors.length > 0) {
    for (const error of errors) {
      logger.error(error);
    }
    
    if (process.env.NODE_ENV === 'production') {
      logger.error('Invalid environment configuration. Exiting...');
      process.exit(1);
    }
  }
  
  // Load secrets from files if specified
  if (process.env.SECRETS_DIR) {
    try {
      const secretsDir = process.env.SECRETS_DIR;
      for (const file of fs.readdirSync(secretsDir)) {
        const key = file.toUpperCase();
        if (key in envVars) {
          const value = fs.readFileSync(path.join(secretsDir, file), 'utf8').trim();
          config[key] = value;
        }
      }
    } catch (error) {
      logger.error(`Error loading secrets from directory: ${error.message}`);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }
  
  return config;
}

const config = processEnvVars();

// Log configuration (but hide secrets)
if (process.env.NODE_ENV !== 'production') {
  const safeConfig = { ...config };
  for (const key of Object.keys(safeConfig)) {
    if (key.includes('SECRET') || key.includes('KEY') || key.includes('PASSWORD')) {
      safeConfig[key] = '********';
    }
  }
  logger.info('Configuration loaded:', safeConfig);
}

export default config;