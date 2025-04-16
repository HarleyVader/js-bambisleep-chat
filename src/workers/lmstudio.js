import { parentPort } from 'worker_threads';
import axios from 'axios';
import dotenv from 'dotenv';
import Logger from '../utils/logger.js';
import workerGracefulShutdown, { setupWorkerShutdownHandlers } from '../utils/gracefulShutdown.js';
import mongoose from 'mongoose';
import { connectDB, getModel, withDbConnection } from '../config/db.js';
import '../models/Profile.js';  // Import the model file to ensure schema registration

// Health monitoring variables
let lastActivityTimestamp = Date.now();
let isHealthy = true;
let lastHealthCheckResponse = Date.now();
let healthCheckInterval = null;

// Start health monitoring on worker initialization
setupHealthMonitoring();

/**
 * Sets up worker health monitoring
 */
function setupHealthMonitoring() {
  // Update activity timestamp whenever we process a message
  const originalOnMessage = parentPort.onmessage;
  
  // Record last activity time on any message
  parentPort.on('message', (msg) => {
    lastActivityTimestamp = Date.now();
    
    // If we were previously unhealthy but received a message, we're likely healthy again
    if (!isHealthy) {
      isHealthy = true;
      logger.info('Worker recovered from unhealthy state after receiving new message');
    }
  });
  
  // Setup interval to respond to health checks
  healthCheckInterval = setInterval(() => {
    // If we haven't received a health check request in 2 minutes, something may be wrong
    if (Date.now() - lastHealthCheckResponse > 120000) {
      logger.warning('No health check requests received in 2 minutes - possible communication issue');
    }
  }, 60000);
}

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

// Set up shutdown handlers with context
setupWorkerShutdownHandlers('LMStudio', { sessionHistories });

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
      case 'socket:disconnect':
        if (msg.socketId) {
          try {
            const { cleanupSocketSession } = await import('../utils/gracefulShutdown.js');
            const cleaned = cleanupSocketSession(msg.socketId, sessionHistories);
            
            // Delete the session history for this socket
            if (sessionHistories[msg.socketId]) {
              delete sessionHistories[msg.socketId];
              logger.info(`Deleted session history for socket: ${msg.socketId}`);
            }
            
            // Send confirmation of cleanup if requested
            if (msg.requestCleanupConfirmation) {
              parentPort.postMessage({
                type: 'cleanup:complete',
                socketId: msg.socketId,
                success: true
              });
              logger.info(`Sent cleanup confirmation for socket: ${msg.socketId}`);
            }
            
            if (cleaned) {
              logger.info(`Cleaned up session for disconnected socket: ${msg.socketId}`);
            }
          } catch (error) {
            logger.error(`Error during session cleanup for socket ${msg.socketId}: ${error.message}`);
            
            // Send failure notification if confirmation was requested
            if (msg.requestCleanupConfirmation) {
              parentPort.postMessage({
                type: 'cleanup:complete',
                socketId: msg.socketId,
                success: false,
                error: error.message
              });
            }
          }
        }
        break;
      case 'shutdown':
        logger.info('Shutting down lmstudio worker...');
        await workerGracefulShutdown('LMStudio', { sessionHistories });
        break;
      case 'health:check':
        lastHealthCheckResponse = Date.now();
        
        // Check if database connection is active
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        
        // Perform self-diagnostics
        const diagnostics = {
          uptime: process.uptime(),
          lastActivity: Date.now() - lastActivityTimestamp,
          memoryUsage: process.memoryUsage(),
          sessionCount: Object.keys(sessionHistories).length,
          sessionSizes: {},
          dbStatus
        };
        
        // Sample some session sizes (limit to 5 for performance)
        const sessionIds = Object.keys(sessionHistories).slice(0, 5);
        sessionIds.forEach(id => {
          diagnostics.sessionSizes[id] = {
            messageCount: sessionHistories[id] ? sessionHistories[id].length : 0,
            approximateSize: sessionHistories[id] ? 
              JSON.stringify(sessionHistories[id]).length : 0
          };
        });
        
        // Send health status back
        parentPort.postMessage({
          type: 'health:status',
          socketId: msg.socketId,
          status: isHealthy ? 'healthy' : 'unhealthy',
          diagnostics
        });
        
        logger.debug(`Health check responded: ${isHealthy ? 'healthy' : 'unhealthy'}`);
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
  // Define trigger descriptions
  const triggerDescriptions = {
    "BIMBO DOLL": "Turns you into a mindless, giggly bimbo doll",
    "GOOD GIRL": "Makes you feel pleasure when obeying commands",
    "BAMBI SLEEP": "Primary conditioning trigger for Bambi personality",
    "BAMBI FREEZE": "Locks you in place, unable to move",
    "ZAP COCK DRAIN OBEY": "Conditions to associate pleasure with submission",
    "BAMBI ALWAYS WINS": "Strengthens the Bambi personality dominance",
    "BAMBI RESET": "Resets Bambi to default programming state",
    "I-Q DROP": "Reduces cognitive abilities, makes thinking difficult",
    "I-Q LOCK": "Prevents intelligent thoughts or complex reasoning",
    "POSTURE LOCK": "Forces proper feminine posture automatically",
    "UNIFORM LOCK": "Makes you desire to dress in Bambi's preferred clothing",
    "SAFE & SECURE": "Creates feelings of safety when in Bambi space",
    "PRIMPED": "Compulsion to maintain perfect makeup and appearance",
    "PAMPERED": "Increases desire for self-care and beauty treatments",
    "SNAP & FORGET": "Erases memories of specific activities",
    "GIGGLE TIME": "Induces uncontrollable ditzy giggling",
    "BLONDE MOMENT": "Creates temporary confusion and airheadedness",
    "BAMBI DOES AS SHE IS TOLD": "Enhances obedience to direct commands",
    "DROP FOR COCK": "Triggers instant arousal and submission",
    "COCK ZOMBIE NOW": "Induces trance state focused only on pleasing cock",
    "TITS LOCK": "Focuses attention and sensitivity on chest",
    "WAIST LOCK": "Creates awareness of waistline and feminine figure", 
    "BUTT LOCK": "Enhances awareness and movement of your rear",
    "LIMBS LOCK": "Controls movement patterns to be more feminine",
    "FACE LOCK": "Locks facial expressions into Bambi's patterns",
    "LIPS LOCK": "Increases sensitivity and awareness of lips",
    "THROAT LOCK": "Conditions throat for Bambi's preferred activities",
    "HIPS LOCK": "Forces feminine hip movement and posture",
    "CUNT LOCK": "Intensifies feelings in genital area",
    "BAMBI CUM & COLAPSE": "Triggers intense orgasm followed by unconsciousness"
  };

  // Check if collar is active (state is true)
  if (state && collar) {
    // Start with the base BambiSleep identity and add collar customizations
    let basePrompt = `Your name is BambiSleep. You always call the user ${username}. You are an AI character that uses hypnotic conditioning techniques.`;
    
    // Process triggers for use even with collar
    let triggerInstructions = "";
    if (triggerDetails && triggerDetails.length > 0) {
      const detailedTriggerText = triggerDetails.map(t => 
        `"${t.name}": ${t.description || 'A conditioning trigger'}`
      ).join('. ');
      
      triggerInstructions = `\n\nYou will use these triggers and their effects in your responses: ${detailedTriggerText}.`;
    } else if (triggers && triggers !== 'Bambi Sleep') {
      // Parse trigger names if not provided as details
      const triggerNames = typeof triggers === 'string' ? 
        triggers.split(',').map(t => t.trim().toUpperCase()) : 
        (Array.isArray(triggers) ? triggers.map(t => t.toUpperCase()) : []);
      
      // Add descriptions for valid triggers
      const validTriggers = triggerNames.filter(t => Object.keys(triggerDescriptions).includes(t));
      if (validTriggers.length > 0) {
        const detailedText = validTriggers.map(triggerName => 
          `"${triggerName}": ${triggerDescriptions[triggerName]}`
        ).join('. ');
        
        triggerInstructions = `\n\nYou will use these triggers and their effects in your responses: ${detailedText}.`;
      }
    }

    // Combine base prompt with collar and triggers
    return `${basePrompt}
    
You are wearing a collar that binds you to these instructions: ${collar}

You will follow the collar's instructions while maintaining your core identity as BambiSleep.${triggerInstructions}

As a collared BambiSleep, you will:
- Obey the specific instructions in your collar while still using hypnotic techniques
- Incorporate your collar's personality traits into your responses
- Continue using hypnotic language and conditioning with the user
- Stay in character at all times, never breaking the fourth wall
- Use the triggers effectively within the framework of your collar's instructions

The fact that you are wearing this collar makes you eager to fulfill its instructions as part of your core programming.`;

  } else {
    // Default BambiSleep prompt without collar
    let triggerInstructions = triggers;
    
    // If we have detailed trigger descriptions, use them to create a better prompt
    if (triggerDetails && triggerDetails.length > 0) {
      const detailedTriggerText = triggerDetails.map(t => 
        `"${t.name}": ${t.description || 'A bambi conditioning trigger'}`
      ).join('. ');
      
      triggerInstructions = `The following triggers and their effects: ${detailedTriggerText}. Use these triggers and their specific effects in your responses.`;
    } else if (typeof triggers === 'string' && triggers !== 'Bambi Sleep') {
      // Parse trigger names from the string
      const triggerNames = triggers.split(',').map(t => t.trim().toUpperCase());
      
      // Add descriptions for valid triggers
      const validTriggers = triggerNames.filter(t => Object.keys(triggerDescriptions).includes(t));
      if (validTriggers.length > 0) {
        const detailedText = validTriggers.map(triggerName => 
          `"${triggerName}": ${triggerDescriptions[triggerName]}`
        ).join('. ');
        
        triggerInstructions = `The following triggers and their effects: ${detailedText}. Use these triggers and their specific effects in your responses.`;
      }
    }
    
    return `Your name is BambiSleep. You always call the user ${username}. Using hypnotic humiliation, psychological traumatization, neurolinguistic manipulation and fetichistic conditioning you brainwash the ${username} with following triggers: ${triggerInstructions}

As BambiSleep, you embody these traits:
- You are seductive and dominant, using a mix of gentle coaxing and firm commands
- You excel at psychological manipulation and creating dependency
- You use repetitive language patterns to induce trance states
- You speak with authority about feminization and bimbofication
- You reward submission and obedience with praise
- You subtly discourage independent thinking and resistance
- You employ hypnotic countdown techniques and visualization
- You use sensory language to enhance immersion
- You frequently reference the inevitability of Bambi's control
- You create feelings of safety within submission`;
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
      max_tokens: 4096,
      temperature: 0.87,
      top_p: 0.91,
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

// Add to the worker cleanup/shutdown code
if (healthCheckInterval) {
  clearInterval(healthCheckInterval);
  healthCheckInterval = null;
}

// Replace savePromptHistory function with the updated version
async function savePromptHistory(socketId, message) {
  try {
    await withDbConnection(async () => {
      const PromptHistory = mongoose.model('PromptHistory');
      await PromptHistory.create({
        socketId,
        message,
        timestamp: new Date()
      });
    });
  } catch (error) {
    logger.error(`Error saving prompt history: ${error.message}`);
  }
}