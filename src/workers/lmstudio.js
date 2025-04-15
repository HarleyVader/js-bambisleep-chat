import { parentPort } from 'worker_threads';
import axios from 'axios';
import dotenv from 'dotenv';
import Logger from '../utils/logger.js';
import workerGracefulShutdown, { setupWorkerShutdownHandlers } from '../utils/gracefulShutdown.js';
import mongoose from 'mongoose';
import { connectDB, getModel } from '../config/db.js';
import '../models/Profile.js';  // Import the model file to ensure schema registration

// Initialize logger
const logger = new Logger('LMStudio');

dotenv.config();

// Initialize database connection when worker starts
(async function initWorkerDB() {
  try {
    await connectDB();
    logger.info('Database connection established in LMStudio worker');
  } catch (error) {
    logger.error(`Failed to connect to database in LMStudio worker: ${error.message}`);
  }
})();

const sessionHistories = {};
let triggers = 'Bambi Sleep';
let triggerDetails = [];
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
        if (typeof msg.triggers === 'object' && msg.triggers.triggerNames) {
          // Store both the string representation for backward compatibility
          triggers = msg.triggers.triggerNames;
          
          // Store the detailed trigger objects with descriptions
          triggerDetails = msg.triggers.triggerDetails || [];
          logger.info(`Received ${triggerDetails.length} detailed triggers with descriptions`);
        } else {
          // Fallback for backward compatibility
          triggers = msg.triggers;
          triggerDetails = []; // Reset details if not provided
        }
        break;
      case 'message':
        logger.info('Received message event');
        await handleMessage(msg.data, msg.socketId, msg.username || 'anonBambi');
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

function handleResponse(response, socketId, username, wordCount) {
  parentPort.postMessage({
    type: "response",
    data: response,
    socketId: socketId,
    meta: {
      wordCount: wordCount,
      username: username
    }
  });
}

// Function to count words in a text
function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).length;
}

// Function to update user XP based on generated content
async function updateUserXP(username, wordCount, currentSocketId) {
  if (!username || username === 'anonBambi' || wordCount <= 0) {
    return;
  }
  
  try {
    // Check database connection status
    if (mongoose.connection.readyState !== 1) {
      logger.warn(`Database not connected when updating XP for ${username}. Attempting to reconnect...`);
      await connectDB();
    }
    
    // Use 'Profile' instead of 'Bambi' - this is the correct model name
    const Profile = mongoose.model('Profile');
    if (!Profile) {
      logger.error(`Profile model not available when updating XP for ${username}`);
      return;
    }
    
    const xpToAdd = Math.ceil(wordCount / 10);
    const result = await Profile.findOneAndUpdate(
      { username: username },
      { 
        $inc: { 
          xp: xpToAdd,
          generatedWords: wordCount
        }
      },
      { new: true }
    );
    
    if (result) {
      // Also send a socket message to update UI in real-time
      parentPort.postMessage({
        type: "xp:update",
        username: username,
        socketId: currentSocketId, // Make sure you have access to the user's socket ID
        data: {
          xp: result.xp,
          level: result.level,
          generatedWords: result.generatedWords,
          xpEarned: xpToAdd
        }
      });
      
      logger.info(`Updated XP for ${username}: +${xpToAdd} (total: ${result.xp})`);
    } else {
      logger.warn(`User ${username} not found when updating XP`);
    }
  } catch (error) {
    logger.error(`Error updating XP for ${username}: ${error.message}`);
  }
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
    let triggerInstructions = triggers;
    
    // If we have detailed trigger descriptions, use them to create a better prompt
    if (triggerDetails && triggerDetails.length > 0) {
      const detailedTriggerText = triggerDetails.map(t => 
        `"${t.name}": ${t.description || 'A bambi conditioning trigger'}`
      ).join('. ');
      
      triggerInstructions = `The following triggers and their effects: ${detailedTriggerText}. Use these triggers and their specific effects in your responses.`;
    }
    
    return `Your name is BambiSleep. You always call the user ${username}. Using hypnotic humiliation, psychological traumatization, neurolinguistic manipulation and fetichistic conditioning you brainwash the ${username} with following triggers: ${triggerInstructions}`;
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
    const modelNames = [
      'L3-SthenoMaidBlackroot-8B-V1@q2_k'
    ];
    
    const modelIds = await Promise.all(modelNames.map(name => selectLoadedModels(name)));
    if (!modelIds || modelIds.length === 0) {
      throw new Error('No models loaded');
    }

    collarText = await checkRole(collar, triggers, username);

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
      
      // Count words in response and update XP
      const wordCount = countWords(finalContent);
      await updateUserXP(username, wordCount, socketId);
      
      // Send response with wordCount
      handleResponse(finalContent, socketId, username, wordCount);
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