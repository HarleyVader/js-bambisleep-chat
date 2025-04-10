import path from 'path';
import { Worker } from 'worker_threads';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Logger from '../utils/logger.js';
import connectToMongoDB from '../utils/dbConnection.js';

// Create ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize logger
const logger = new Logger('WorkerCoordinator');

dotenv.config();

// Add the selectLoadedModels function directly in this file
async function selectLoadedModels(modelName) {
  const response = await axios.get(`http://${process.env.LMS_HOST}:${process.env.LMS_PORT}/v1/models`);
  const models = response.data.data;
  const selectedModel = models.find(model => model.id.toLowerCase().includes(modelName.toLowerCase()));
  return selectedModel ? selectedModel.id : models[0].id;
}

class WorkerCoordinator {
  constructor() {
    this.workers = {
      text: null,
      image: null,
      video: null
    };
    
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;
    this.models = []; // Array to hold loaded models
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      logger.info('Worker coordinator already initialized');
      return true;
    }
    
    try {
      // Ensure database connection is established first
      await connectToMongoDB();
      
      // Load models
      const modelNames = [
        'llama-3.2-3b-claude-3.7-sonnet-reasoning-distilled@q4_0',
        'another-model-name' // Replace with the second model name as needed
      ];
      
      for (const modelName of modelNames) {
        try {
          const modelId = await selectLoadedModels(modelName);
          this.models.push(modelId);
        } catch (error) {
          logger.error(`Error loading model ${modelName}:`, error);
          // Continue with initialization even if model loading fails
        }
      }

      // Create and start text worker
      this.workers.text = new Worker(path.join(__dirname, 'scrapers/textScraping.js'));
      this.workers.text.on('message', this.handleWorkerMessage.bind(this));
      this.workers.text.on('error', this.handleWorkerError.bind(this));
      
      // Create and start image worker
      this.workers.image = new Worker(path.join(__dirname, 'scrapers/imageScraping.js'));
      this.workers.image.on('message', this.handleWorkerMessage.bind(this));
      this.workers.image.on('error', this.handleWorkerError.bind(this));
      
      // Create and start video worker
      this.workers.video = new Worker(path.join(__dirname, 'scrapers/videoScraping.js'));
      this.workers.video.on('message', this.handleWorkerMessage.bind(this));
      this.workers.video.on('error', this.handleWorkerError.bind(this));
      
      this.initialized = true;
      logger.info('All workers initialized and started');
      return true;
    } catch (error) {
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

  async shutdown() {
    try {
      logger.info('Shutting down worker coordinator...');
      
      // Shutdown all workers
      for (const [type, worker] of Object.entries(this.workers)) {
        if (worker) {
          worker.postMessage({ type: 'shutdown' });
          logger.info(`Sent shutdown signal to ${type} worker`);
        }
      }
      
      logger.success('Worker coordinator shutdown complete');
    } catch (error) {
      logger.error('Error shutting down worker coordinator:', error);
    }
  }
}

// Export singleton instance
const workerCoordinator = new WorkerCoordinator();
export default workerCoordinator;

// Initialize workers on application startup
workerCoordinator.initialize();