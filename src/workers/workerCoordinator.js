import path from 'path';
import { Worker } from 'worker_threads';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Logger from '../utils/logger.js';
import connectToMongoDB from '../utils/dbConnection.js';
import mongoose from 'mongoose';
import express from 'express';
import apiRoutes from './routes/api.js';

// Create ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize logger
const logger = new Logger('WorkerCoordinator');

dotenv.config();

const AVAILABLE_MODELS = {
  claude: {
    id: 'llama-3.2-3b-claude-3.7-sonnet-reasoning-distilled@q4_0',
    type: 'chat',
    name: 'Claude 3.5 Sonnet',
    enabled: true,
    default: true
  },
  embedding: {
    id: 'text-embedding-nomic-embed-text-v1.5',
    type: 'embedding',
    name: 'Nomic Embed',
    enabled: true
  },
  sthenomaid: {
    id: 'l3-sthenomaidblackroot-8b-v1@q2_k',
    type: 'chat',
    name: 'SthenoMaidBlackroot 8B v1',
    enabled: true
  }
};

// Update selectLoadedModels function
const getEnabledModels = () => {
  const models = [];
  for (const [, model] of Object.entries(AVAILABLE_MODELS)) {
    if (model.enabled) {
      models.push(model);
    }
  }
  return models;
};

// Helper function to create a delay between operations
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class WorkerCoordinator {  
  constructor() {
    this.workers = {
      text: null,
      image: null,
      video: null,
      imageGenerator: null
    };
    
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;
    this.models = []; // Array to hold loaded models
    this.initialized = false;
    this.initializing = false;
  }

  async initialize() {
    if (this.initialized) {
      logger.info('Worker coordinator already initialized');
      return true;
    }
    
    // Check MongoDB connection with retry
    if (mongoose.connection.readyState !== 1) {
      logger.warning('MongoDB not connected. Worker initialization waiting for database connection...');
      // Try to connect to the database if it's not connected
      let connected = false;
      for (let i = 0; i < 3; i++) {
        try {
          await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 15000
          });
          connected = true;
          logger.success('Worker coordinator established MongoDB connection');
          break;
        } catch (err) {
          logger.error(`Worker coordinator failed to connect to MongoDB (attempt ${i+1}/3): ${err.message}`);
          if (i < 2) await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      if (!connected) {
        logger.warning('MongoDB connection failed, worker coordinator proceeding with limited functionality');
      }
    }
    
    if (this.initializing) {
      logger.info('Worker coordinator initialization already in progress');
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (this.initialized) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 300);
      });
    }
    
    this.initializing = true;
    
    try {      
      // Load models - staggered loading with status updates
      const enabledModels = getEnabledModels();
      
      logger.info('Beginning model loading sequence...');
      
      for (let i = 0; i < enabledModels.length; i++) {
        const model = enabledModels[i];
        logger.info(`Loading model ${i+1}/${enabledModels.length}: ${model.name} (${model.id})`);
        
        try {
          this.models.push(model);
          logger.success(`Model ${i+1}/${enabledModels.length} loaded: ${model.name} (${model.id})`);
        } catch (error) {
          logger.error(`Error processing model ${model.name}: ${error.message}`, error);
        }
        
        // Small delay between model loading - reduced to 200ms
        if (i < enabledModels.length - 1) {
          await delay(200);
        }
      }

      // Staggered worker initialization with shorter delays
      logger.info('Beginning worker initialization sequence...');
      
      // Create and start text worker
      logger.info('Initializing text scraper worker (1/3)...');
      this.workers.text = new Worker(path.join(__dirname, 'scrapers/textScraping.js'));
      this.workers.text.on('message', this.handleWorkerMessage.bind(this));
      this.workers.text.on('error', this.handleWorkerError.bind(this));
      
      // Wait for first worker to initialize - reduced to 250ms
      await delay(250);
      
      // Create and start image worker
      logger.info('Initializing image scraper worker (2/3)...');
      this.workers.image = new Worker(path.join(__dirname, 'scrapers/imageScraping.js'));
      this.workers.image.on('message', this.handleWorkerMessage.bind(this));
      this.workers.image.on('error', this.handleWorkerError.bind(this));
      
      // Wait again - reduced to 250ms
      await delay(250);
      
      // Create and start video worker
      logger.info('Initializing video scraper worker (3/4)...');
      this.workers.video = new Worker(path.join(__dirname, 'scrapers/videoScraping.js'));
      this.workers.video.on('message', this.handleWorkerMessage.bind(this));
      this.workers.video.on('error', this.handleWorkerError.bind(this));
      
      // Wait again - reduced to 250ms
      await delay(250);
      
      // Create and start image generator worker
      logger.info('Initializing image generator worker (4/4)...');
      this.workers.imageGenerator = new Worker(path.join(__dirname, 'imageGenerator.js'));
      this.workers.imageGenerator.on('message', this.handleWorkerMessage.bind(this));
      this.workers.imageGenerator.on('error', this.handleWorkerError.bind(this));
      
      this.initialized = true;
      this.initializing = false;
      logger.success('All workers initialized and ready for scraping tasks');
      return true;
    } catch (error) {
      this.initializing = false;
      logger.error('Error initializing worker coordinator:', error);
      return false;
    }
  }

  generateRequestId() {
    return `req_${Date.now()}_${++this.requestIdCounter}`;
  }

  handleWorkerMessage(message) {
    const { type, data, requestId, error } = message;
    
    if (error) {
      logger.error(`Worker error: ${error}`);
      if (this.pendingRequests.has(requestId)) {
        const { callback } = this.pendingRequests.get(requestId);
        callback(error, null);
      }
      return;
    }
    
    if (this.pendingRequests.has(requestId)) {
      const { callback } = this.pendingRequests.get(requestId);
      callback(null, data);
    }
  }

  handleWorkerError(error) {
    logger.error(`Worker error: ${error.message}`);
  }

  scrapeUrl(url, callback) {
    if (!this.initialized) {
      return callback(new Error('Worker coordinator not initialized'), null);
    }
    
    const results = {
      text: null,
      image: null,
      video: null
    };
    
    let completedRequests = 0;
    const totalRequests = 3; // text, image, video
    
    const handleResponse = (type, error, data) => {
      if (error) {
        logger.error(`Error in ${type} scraping: ${error}`);
      } else {
        results[type] = data;
      }
      completedRequests++;
      if (completedRequests === totalRequests) {
        callback(null, results);
      }
    };
    
    // Send request to text worker
    const textRequestId = this.generateRequestId();
    this.pendingRequests.set(textRequestId, { 
      callback: (err, data) => handleResponse('text', err, data) 
    });
    this.workers.text.postMessage({
      type: 'scrape_url',
      url,
      requestId: textRequestId
    });
    
    // Send request to image worker
    const imageRequestId = this.generateRequestId();
    this.pendingRequests.set(imageRequestId, { 
      callback: (err, data) => handleResponse('image', err, data) 
    });
    this.workers.image.postMessage({
      type: 'scrape_images',
      url,
      requestId: imageRequestId
    });
    
    // Send request to video worker
    const videoRequestId = this.generateRequestId();
    this.pendingRequests.set(videoRequestId, { 
      callback: (err, data) => handleResponse('video', err, data) 
    });
    this.workers.video.postMessage({
      type: 'scrape_videos',
      url,
      requestId: videoRequestId
    });  
  }

  generateImage(options, callback) {
    if (!this.initialized) {
      return callback(new Error('Worker coordinator not initialized'), null);
    }
    
    if (!this.workers.imageGenerator) {
      return callback(new Error('Image generator worker not available'), null);
    }
    
    const requestId = this.generateRequestId();
    this.pendingRequests.set(requestId, { callback });
    
    this.workers.imageGenerator.postMessage({
      type: 'generate-image',
      data: options,
      requestId
    });
  }

  checkImageJobStatus(jobId, callback) {
    if (!this.initialized) {
      return callback(new Error('Worker coordinator not initialized'), null);
    }
    
    if (!this.workers.imageGenerator) {
      return callback(new Error('Image generator worker not available'), null);
    }
    
    const requestId = this.generateRequestId();
    this.pendingRequests.set(requestId, { callback });
    
    this.workers.imageGenerator.postMessage({
      type: 'check-job-status',
      data: { jobId },
      requestId
    });
  }
  
  checkImageWorkerHealth(callback) {
    if (!this.initialized) {
      return callback(new Error('Worker coordinator not initialized'), false);
    }
    
    if (!this.workers.imageGenerator) {
      return callback(new Error('Image generator worker not available'), false);
    }
    
    const requestId = this.generateRequestId();
    this.pendingRequests.set(requestId, { 
      callback: (error, result) => {
        if (error) {
          return callback(error, false);
        }
        
        // Check if the worker is healthy
        const isHealthy = result && result.status === 'healthy';
        callback(null, isHealthy);
      }
    });
    
    // Send health check request to the worker
    this.workers.imageGenerator.postMessage({
      type: 'health-check',
      requestId
    });
  }

  async shutdown() {
    try {
      logger.info('Shutting down worker coordinator...');
      
      // Shutdown workers in sequence - reduced delays
      const workerTypes = Object.keys(this.workers);
      
      for (let i = 0; i < workerTypes.length; i++) {
        const type = workerTypes[i];
        const worker = this.workers[type];
        
        if (worker) {
          logger.info(`Shutting down ${type} worker (${i+1}/${workerTypes.length})...`);
          worker.postMessage({ type: 'shutdown' });
          await delay(150); // Small delay between worker shutdowns
        }
      }
      
      logger.success('Worker coordinator shutdown complete');
    } catch (error) {
      logger.error('Error shutting down worker coordinator:', error);
    }
  }

  async getAvailableModels() {
    try {
      const models = await getEnabledModels();
      return models;
    } catch (error) {
      throw new Error('Failed to retrieve available models');
    }
  }

  async enableModel(modelId) {
    try {
      if (AVAILABLE_MODELS[modelId]) {
        AVAILABLE_MODELS[modelId].enabled = true;
        logger.info(`Model ${modelId} enabled successfully`);
      } else {
        throw new Error(`Model ${modelId} not found`);
      }
    } catch (error) {
      throw new Error(`Failed to enable model ${modelId}: ${error.message}`);
    }
  }
}

// Export singleton instance
const workerCoordinator = new WorkerCoordinator();
export default workerCoordinator;

// Don't automatically initialize - let server.js control initialization
// workerCoordinator.initialize();

const modelManagementRouter = express.Router(); // Renamed to avoid conflict

// Model routes
modelManagementRouter.get('/models', async (req, res) => {
  try {
    const models = await workerCoordinator.getAvailableModels();
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enable model for all clients
modelManagementRouter.post('/models/enable/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;
    await workerCoordinator.enableModel(modelId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { modelManagementRouter }; // Export as named export

// In the setupRoutes function
app.use('/api', apiRoutes);