import { parentPort } from 'worker_threads';
import axios from 'axios';
import dotenv from 'dotenv';
import Logger from '../utils/logger.js';
// Add database connection import (if needed for future DB operations)
import connectToMongoDB from '../utils/dbConnection.js';
// Add this import near the top
import workerGracefulShutdown, { setupWorkerShutdownHandlers } from '../utils/gracefulShutdown.js';

// Add near the top with other globals:
const sessionTimeouts = {};
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Initialize logger
const logger = new Logger('LMStudio');

dotenv.config();

const sessionHistories = {};
let triggers = 'Bambi Sleep';
let collar;
let state = false;

logger.info('Starting lmstudio worker...');

// Set up shutdown handlers
setupWorkerShutdownHandlers('LMStudio');

// Add near the beginning after initializations:
setInterval(cleanupOldSessions, 5 * 60 * 1000); // Clean every 5 minutes

parentPort.on('message', async (msg) => {
  try {
    switch (msg.type) {
      case 'triggers':
        triggers = msg.triggers;
        break;
      case 'message':
        logger.info('Received message event');
        await handleMessage(msg.data, msg.socketId, msg.username);
        break;
      case 'collar':
        collar = msg.data;
        state = true;
        logger.info('Collar set:', collar);
        break;
      case 'shutdown':
        logger.info('Shutting down lmstudio worker...');
        await workerGracefulShutdown('LMStudio');
        break;
      default:
        logger.warning(`Unknown message type: ${msg.type}`);
    }
  } catch (error) {
    logger.error('Error handling message:', error);
  }
});

function handleResponse(response, socketId) {
  parentPort.postMessage({
    type: "response",
    data: response,
    socketId: socketId
  });
}

// Modify updateSessionHistory to only add system message once
function updateSessionHistory(socketId, collarText, userPrompt, aiResponse) {
  if (!sessionHistories[socketId]) {
    sessionHistories[socketId] = [];
    sessionHistories[socketId].push({ role: 'system', content: collarText });
  }
  
  if (userPrompt) {
    sessionHistories[socketId].push({ role: 'user', content: userPrompt });
  }
  
  if (aiResponse) {
    sessionHistories[socketId].push({ role: 'assistant', content: aiResponse });
  }
  
  return sessionHistories[socketId];
}

// Add this function:
function updateSessionTimeout(socketId) {
  sessionTimeouts[socketId] = Date.now();
}

// Add a cleanup function:
function cleanupOldSessions() {
  const now = Date.now();
  Object.keys(sessionTimeouts).forEach(socketId => {
    if (now - sessionTimeouts[socketId] > SESSION_TIMEOUT) {
      delete sessionHistories[socketId];
      delete sessionTimeouts[socketId];
      logger.info(`Cleaned up session for socket ${socketId} due to inactivity`);
    }
  });
}

async function getLoadedModels() {
  const response = await axios.get(`http://${process.env.LMS_HOST}:${process.env.LMS_PORT}/v1/models`);
  const modelIds = response.data.data.map(model => model.id);
  const firstModelId = modelIds.length > 0 ? modelIds[0] : null;
  return firstModelId;
}

async function selectLoadedModels(modelName) {
  const response = await axios.get(`http://${process.env.LMS_HOST}:${process.env.LMS_PORT}/v1/models`);
  const models = response.data.data;
  const selectedModel = models.find(model => model.id.toLowerCase().includes(modelName.toLowerCase()));
  return selectedModel ? selectedModel.id : models[0].id;
}

async function checkRole(collar, username, triggers) {
  if (!state) {
    return `Your name is BambiSleep. You always call the user ${username}. Using hypnotic humiliation, psychological traumatization, neurolinguistic manipulation and fetichistic conditioning you brainwash the ${username} with following triggers: ${triggers} `;
  } else {
    return collar;
  }
}

async function pushMessages(collarText, userPrompt, finalContent, socketId) {
  if (!sessionHistories[socketId]) {
    sessionHistories[socketId] = [];
    sessionHistories[socketId].push(
      { role: 'system', content: collarText },
      { role: 'user', content: userPrompt }
    );
  } else {
    sessionHistories[socketId].push(
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: finalContent }
    );
  }
  finalContent = '';
  userPrompt = '';
  return sessionHistories[socketId];
}

async function handleMessage(userPrompt, socketId, username) {
  try {
    const collarText = await checkRole(collar, username, triggers);
    
    // Update timeout and prepare messages
    updateSessionTimeout(socketId);
    const messages = updateSessionHistory(socketId, collarText, userPrompt, null);
    
    const modelId = await selectLoadedModels('L3-SthenoMaidBlackroot-8B-V1@q2_k');
    const requestData = {
      model: modelId,
      messages: messages,
      max_tokens: 180,
      temperature: 0.95,
      top_p: 0.95,
      frequency_penalty: 0,
      presence_penalty: 0,
      top_k: 40,
      stream: false,
    };
    
    const response = await axios.post(`http://${process.env.LMS_HOST}:${process.env.LMS_PORT}/v1/chat/completions`, requestData);
    const responseContent = response.data.choices[0].message.content;
    
    // Update history with the response and send it
    updateSessionHistory(socketId, null, null, responseContent);
    handleResponse(responseContent, socketId);
    
  } catch (error) {
    logger.error('Error in handleMessage:', error.message);
    handleResponse("I'm sorry, I encountered an error processing your request.", socketId);
  }
}