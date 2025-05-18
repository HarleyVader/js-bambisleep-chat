// MongoDB configuration checker and validator
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Logger from '../utils/logger.js';

// Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = new Logger('MongoDBConfig');

// Load environment variables
dotenv.config();

// Default MongoDB configs to check
const mongoConfigs = {
  MONGODB_URI: {
    required: true,
    description: 'Primary MongoDB connection string',
    validate: (uri) => {
      // Basic validation for mongodb URI format
      return typeof uri === 'string' && 
        (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'));
    },
    suggestion: 'mongodb://localhost:27017/bambisleep or mongodb+srv://user:password@cluster.example.com/bambisleep'
  },
  MONGODB_FALLBACK_URI: {
    required: false,
    description: 'Fallback MongoDB connection string',
    validate: (uri) => {
      if (!uri) return true; // Optional
      return typeof uri === 'string' && 
        (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'));
    },
    suggestion: 'mongodb://localhost:27017/bambisleep'
  },
  MONGODB_DEBUG: {
    required: false,
    description: 'Enable detailed MongoDB logging',
    validate: (value) => {
      if (!value) return true; // Optional
      return value === 'true' || value === 'false';
    },
    suggestion: 'true or false'
  },
  MONGODB_MAX_POOL_SIZE: {
    required: false,
    description: 'Maximum number of connections in pool',
    validate: (value) => {
      if (!value) return true; // Optional
      const num = parseInt(value, 10);
      return !isNaN(num) && num > 0 && num <= 100;
    },
    suggestion: 'A number between 5 and 20 for most applications'
  },
  MONGODB_RETRY_WRITES: {
    required: false,
    description: 'Enable automatic retry of write operations',
    validate: (value) => {
      if (!value) return true; // Optional
      return value === 'true' || value === 'false';
    },
    suggestion: 'true or false'
  }
};

// Validate MongoDB configuration
export function validateMongoDBConfig() {
  logger.info('Validating MongoDB configuration...');
  
  const results = {
    valid: true,
    missing: [],
    invalid: [],
    config: {}
  };
  
  // Check each configuration key
  for (const [key, config] of Object.entries(mongoConfigs)) {
    const value = process.env[key];
    results.config[key] = value ? value.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@') : undefined;
    
    // Check if required and missing
    if (config.required && !value) {
      results.valid = false;
      results.missing.push({
        key,
        description: config.description,
        suggestion: config.suggestion
      });
      continue;
    }
    
    // Check if present but invalid
    if (value && config.validate && !config.validate(value)) {
      results.valid = false;
      results.invalid.push({
        key,
        value: results.config[key],
        description: config.description,
        suggestion: config.suggestion
      });
    }
  }
  
  return results;
}

// Generate sample .env content for MongoDB
export function generateSampleConfig() {
  let envContent = '# MongoDB Configuration\n';
  
  for (const [key, config] of Object.entries(mongoConfigs)) {
    envContent += `# ${config.description}\n`;
    if (config.required) {
      envContent += `${key}=${config.suggestion}\n\n`;
    } else {
      envContent += `# ${key}=${config.suggestion}\n\n`;
    }
  }
  
  return envContent;
}

// Check if MongoDB config is valid and output results
export function checkMongoDBConfig() {
  const validation = validateMongoDBConfig();
  
  if (validation.valid) {
    logger.success('MongoDB configuration is valid');
    
    // Log the config with sensitive information masked
    logger.info('Current MongoDB configuration:');
    for (const [key, value] of Object.entries(validation.config)) {
      if (value) {
        logger.info(`  ${key}: ${value}`);
      }
    }
    
    return true;
  } else {
    logger.error('MongoDB configuration has issues:');
    
    // Log missing required variables
    if (validation.missing.length > 0) {
      logger.error('Missing required variables:');
      validation.missing.forEach(item => {
        logger.error(`  ${item.key}: ${item.description}`);
        logger.info(`    Suggestion: ${item.suggestion}`);
      });
    }
    
    // Log invalid variables
    if (validation.invalid.length > 0) {
      logger.error('Invalid variables:');
      validation.invalid.forEach(item => {
        logger.error(`  ${item.key}: ${item.description}`);
        logger.info(`    Current: ${item.value}`);
        logger.info(`    Suggestion: ${item.suggestion}`);
      });
    }
    
    // Generate sample configuration
    const sampleConfig = generateSampleConfig();
    console.log('\nSample MongoDB Configuration for .env file:');
    console.log(sampleConfig);
    
    return false;
  }
}

// Run validation if called directly
if (process.argv[1].endsWith('mongoConfig.js')) {
  checkMongoDBConfig();
}

export default {
  validateMongoDBConfig,
  generateSampleConfig,
  checkMongoDBConfig
};
