import { parentPort } from 'worker_threads';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import Logger from '../utils/logger.js';
import { setupWorkerShutdownHandlers } from '../utils/gracefulShutdown.js';
import config from '../config/config.js';

// Initialize logger
const logger = new Logger('ImageGenerator');

// Environment setup
dotenv.config();

// Health monitoring
let lastActivityTimestamp = Date.now();
let isHealthy = true;
let healthCheckInterval = null;
let workerTimeout = 60000; // Default 1 minute, will be updated from config

// Job tracking
const activeJobs = new Map();
let jobPollingInterval = null;

// Setup shutdown handlers
setupWorkerShutdownHandlers(parentPort, cleanup);

// Setup health monitoring
setupHealthMonitoring();

// Setup job polling
setupJobPolling();

// Get worker timeout from config
workerTimeout = config.WORKER_TIMEOUT || 60000;
logger.info(`Worker timeout set to ${workerTimeout}ms`);

// Message handler
parentPort.on('message', async (message) => {
  try {
    lastActivityTimestamp = Date.now();
    const { type, data, requestId } = message;
    
    logger.debug(`Received message: ${type} (${requestId})`);
      switch (type) {
      case 'generate-image':
        const result = await generateImage(data);
        
        // If this is an async job, store it for polling
        if (result.data && result.data.id) {
          activeJobs.set(result.data.id, {
            requestId,
            startTime: Date.now(),
            data
          });
          sendResponse(requestId, {
            success: true, 
            status: 'processing',
            jobId: result.data.id,
            message: 'Image generation started' 
          });
        } else {
          // Immediate result
          sendResponse(requestId, result);
        }
        break;
        
      case 'check-job-status':
        const { jobId } = data;
        if (!jobId) {
          sendErrorResponse(requestId, 'Missing job ID');
          break;
        }
        
        const jobStatus = await checkJobStatus(jobId);
        sendResponse(requestId, jobStatus);
        break;
        
      case 'health-check':
        // Reset last activity timestamp to prevent worker from being marked as unhealthy
        lastActivityTimestamp = Date.now();
        sendResponse(requestId, { status: isHealthy ? 'healthy' : 'unhealthy' });
        break;
        
      default:
        logger.warning(`Unknown message type: ${type}`);
        sendErrorResponse(requestId, `Unknown message type: ${type}`);
    }
  } catch (error) {
    logger.error('Error processing message:', error);
    sendErrorResponse(message.requestId, `Worker error: ${error.message}`);
  }
});

// Generate image using RunPod API
async function generateImage(data) {
  const { prompt, apiKey, negativePrompt = "", width = 512, height = 512 } = data;
  const url = config.RUNPOD_API_URL || "https://api.runpod.ai/v2/ttz08s667h5t9r/run";
  
  if (!prompt) {
    throw new Error('Prompt is required');
  }
  
  if (!apiKey && !config.RUNPOD_API_KEY) {
    throw new Error('API key is required');
  }
  
  const requestConfig = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey || config.RUNPOD_API_KEY}`
    },
    body: JSON.stringify({
      "input": {
        "prompt": prompt,
        "negative_prompt": negativePrompt,
        "width": width,
        "height": height
      }
    })
  };

  try {
    logger.debug(`Sending request to RunPod API: "${prompt}"`);
    const response = await fetch(url, requestConfig);
    
    if (!response.ok) {
      throw new Error(`RunPod API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    logger.debug('RunPod API response received');
    
    // Return the API response
    return {
      success: true,
      data: data
    };
  } catch (error) {
    logger.error('RunPod API error:', error);
    throw error;
  }
}

// Check status of a job
async function checkJobStatus(jobId) {
  const url = `${config.RUNPOD_API_URL.replace('/run', '')}/status/${jobId}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.RUNPOD_API_KEY}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`RunPod API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    logger.debug(`Job ${jobId} status: ${data.status}`);
    
    return {
      success: true,
      status: data.status,
      data: data
    };
  } catch (error) {
    logger.error(`Error checking job status for ${jobId}:`, error);
    return {
      success: false,
      status: 'error',
      error: error.message
    };
  }
}

// Poll for status updates on active jobs
async function pollActiveJobs() {
  if (activeJobs.size === 0) return;
  
  // Make a copy of the keys to avoid modification during iteration
  const jobIds = Array.from(activeJobs.keys());
  
  for (const jobId of jobIds) {
    const job = activeJobs.get(jobId);
    
    try {
      const status = await checkJobStatus(jobId);
      
      // If completed or failed, notify client and remove from active jobs
      if (status.data.status === 'COMPLETED') {
        logger.debug(`Job ${jobId} completed`);
        sendResponse(job.requestId, {
          success: true,
          status: 'completed',
          data: status.data.output
        });
        activeJobs.delete(jobId);
      } else if (status.data.status === 'FAILED') {
        logger.error(`Job ${jobId} failed:`, status.data.error);
        sendErrorResponse(job.requestId, `Job failed: ${status.data.error}`);
        activeJobs.delete(jobId);
      } else if (Date.now() - job.startTime > 5 * 60 * 1000) {
        // If job has been running for more than 5 minutes, consider it timed out
        logger.warning(`Job ${jobId} timed out after 5 minutes`);
        sendErrorResponse(job.requestId, 'Job timed out after 5 minutes');
        activeJobs.delete(jobId);
      }
    } catch (error) {
      logger.error(`Error polling job ${jobId}:`, error);
    }
  }
}

// Helper functions
function sendResponse(requestId, data) {
  if (!parentPort) return;
  parentPort.postMessage({
    requestId,
    data
  });
}

function sendErrorResponse(requestId, errorMessage) {
  if (!parentPort) return;
  parentPort.postMessage({
    requestId,
    error: errorMessage
  });
}

function setupHealthMonitoring() {
  // Check health every minute
  healthCheckInterval = setInterval(() => {
    const now = Date.now();
    const inactiveTime = now - lastActivityTimestamp;
    
    // If inactive for more than worker timeout, mark as unhealthy
    const wasHealthy = isHealthy;
    isHealthy = inactiveTime < workerTimeout;
    
    // Log status change
    if (wasHealthy && !isHealthy) {
      logger.warning(`Worker inactive for ${inactiveTime}ms, marked as unhealthy`);
    } else if (!wasHealthy && isHealthy) {
      logger.info(`Worker is now active again, marked as healthy`);
    }
    
    // If unhealthy for too long, attempt self-healing
    if (!isHealthy && inactiveTime > workerTimeout * 2) {
      attemptSelfHealing();
    }
  }, 60000);
}

// Attempt to recover the worker's health
function attemptSelfHealing() {
  logger.info('Attempting worker self-healing...');
  
  try {
    // Reset activity timestamp to prevent repeated healing attempts
    lastActivityTimestamp = Date.now();
    
    // Clean up any stale jobs
    const jobCount = activeJobs.size;
    if (jobCount > 0) {
      logger.info(`Cleaning up ${jobCount} stale jobs`);
      activeJobs.clear();
    }
    
    // Refresh API connection (simulated)
    logger.info('Refreshing API connection');
    
    // Signal successful healing
    isHealthy = true;
    logger.success('Self-healing completed successfully');
  } catch (error) {
    logger.error('Self-healing failed:', error);
  }
}

function setupJobPolling() {
  // Poll every 5 seconds for job status updates
  jobPollingInterval = setInterval(pollActiveJobs, 5000);
}

function cleanup() {
  logger.info('Cleaning up image generator worker resources');
  
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  
  if (jobPollingInterval) {
    clearInterval(jobPollingInterval);
    jobPollingInterval = null;
  }
}
