import { parentPort } from 'worker_threads';
import axios from 'axios';
import dotenv from 'dotenv';
import Logger from '../utils/logger.js';
// Add database connection import (if needed for future DB operations)
import dbConnection from '../database/dbConnection.js';

// Ensure database connection is established when the worker starts
try {
  await dbConnection.connect();
  logger.info('Database connection established successfully in lmstudio worker');
} catch (error) {
  logger.error('Failed to establish database connection in lmstudio worker:', error);
  throw new ConnectionError('Failed to connect to the database');
}

// Add this import near the top
import workerGracefulShutdown, { setupWorkerShutdownHandlers } from '../utils/gracefulShutdown.js';

// Initialize logger
const logger = new Logger('LMStudio');

dotenv.config();

const sessionHistories = {};
let triggers = 'Bambi Sleep';
let collar;
let collarText;
let finalContent;
let state = false;

logger.info('Starting lmstudio worker...');

// Set up shutdown handlers
setupWorkerShutdownHandlers('LMStudio');

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

// Keep in-memory session history
function updateSessionHistory(socketId, collarText, userPrompt, finalContent) {
  if (!sessionHistories[socketId]) {
    sessionHistories[socketId] = [];
  }
  sessionHistories[socketId].push(
    { role: 'system', content: collarText },
    { role: 'user', content: userPrompt },
    { role: 'assistant', content: finalContent }
  );
  return sessionHistories[socketId];
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

async function handleMessage(userPrompt, username, socketId) {
  try {
    const modelNames = [
      'L3-SthenoMaidBlackroot-8B-V1@q2_k'
    ];
    
    const modelIds = await Promise.all(modelNames.map(name => selectLoadedModels(name)));
    if (!modelIds || modelIds.length === 0) {
      throw new Error('No models loaded');
    }

    collarText = await checkRole(collar, username, triggers);

    const messages = updateSessionHistory(socketId, collarText, userPrompt, finalContent);
    if (messages.length === 0) {
      logger.error('No messages found for socketId:', socketId);
      return;
    }

    const requestData = {
      model: modelIds[0], // Use the first model for the request
      messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
      max_tokens: 180,
      temperature: 0.95,
      top_p: 0.95,
      frequency_penalty: 0,
      presence_penalty: 0,
      top_k: 40,
      stream: false,
    };

    try {
      const response = await axios.post(`http://${process.env.LMS_HOST}:${process.env.LMS_PORT}/v1/chat/completions`, requestData);

      let responseData = response.data.choices[0].message.content;
      finalContent = responseData;
      handleResponse(finalContent, socketId);
      finalContent = '';
    } catch (error) {
      if (error.response) {
        logger.error('Error response data:', error.response.data);
      } else {
        logger.error('Error in request:', error.message);
      }
    }
  } catch (error) {
    logger.error('Error in handleMessage:', error);
  }
}