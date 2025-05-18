import dotenv from 'dotenv';
import Logger from '../utils/logger.js';
import workerCoordinator from '../workers/workerCoordinator.js';
import config from '../config/config.js';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = new Logger('ImageGeneratorTest');

// Set API key from environment
const apiKey = process.env.RUNPOD_API_KEY || config.RUNPOD_API_KEY;

// Check for API key
if (!apiKey) {
  logger.error('Missing RUNPOD_API_KEY in environment or config');
  process.exit(1);
}

// For tracking active jobs
let activeJobId = null;
let pollingInterval = null;

// Test function
async function testImageGeneration() {
  logger.info('Initializing worker coordinator...');
  const initialized = await workerCoordinator.initialize();
  
  if (!initialized) {
    logger.error('Failed to initialize worker coordinator');
    process.exit(1);
  }
  
  logger.info('Worker coordinator initialized');
  
  // Generate test image
  logger.info('Testing image generation with prompt: "A cute cat"');
  
  workerCoordinator.generateImage({
    prompt: 'A cute cat',
    negativePrompt: 'ugly, distorted',
    width: 512,
    height: 512,
    apiKey
  }, (error, result) => {
    if (error) {
      logger.error('Image generation test failed:', error);
      cleanup(1);
      return;
    }
    
    // Check if this is an async job
    if (result.status === 'processing' && result.jobId) {
      logger.info(`Async job started with ID: ${result.jobId}`);
      activeJobId = result.jobId;
      
      // Start polling for job status
      pollingInterval = setInterval(() => {
        checkJobStatus(activeJobId);
      }, 5000);
      
      // Set a timeout to prevent hanging indefinitely
      setTimeout(() => {
        logger.error('Test timed out after 5 minutes');
        cleanup(1);
      }, 5 * 60 * 1000);
    } else {
      // Immediate result
      logger.success('Image generation test successful with immediate result');
      logger.info('Result:', result);
      cleanup(0);
    }
  });
}

// Check the status of a job
function checkJobStatus(jobId) {
  workerCoordinator.checkImageJobStatus(jobId, (error, result) => {
    if (error) {
      logger.error(`Error checking job status: ${error.message}`);
      return;
    }
    
    logger.info(`Job ${jobId} status: ${result.status}`);
    
    // If job is complete, finish the test
    if (result.status === 'COMPLETED') {
      logger.success('Image generation job completed successfully');
      logger.info('Result:', result.data);
      cleanup(0);
    } else if (result.status === 'FAILED') {
      logger.error('Image generation job failed');
      cleanup(1);
    }
  });
}

// Clean up resources
function cleanup(exitCode = 0) {
  logger.info('Cleaning up test resources...');
  
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  
  workerCoordinator.shutdown()
    .then(() => {
      logger.info('Test complete, exiting');
      process.exit(exitCode);
    })
    .catch(error => {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    });
}

// Run the test
testImageGeneration();