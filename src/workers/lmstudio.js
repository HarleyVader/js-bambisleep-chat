import { parentPort } from 'worker_threads';
import axios from 'axios';
import dotenv from 'dotenv';
import Logger from '../utils/logger.js';
import { handleWorkerShutdown, setupWorkerShutdownHandlers } from '../utils/gracefulShutdown.js';
import mongoose from 'mongoose';
import { connectDB, withDbConnection } from '../config/db.js';
import '../models/Profile.js';  // Import the model file to ensure schema registration
import '../models/SessionHistory.js';  // Make sure to create this file first
import config from '../config/config.js';
import SessionHistoryModel from '../models/SessionHistory.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Initialize logger first before using it
const logger = new Logger('LMStudio');

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load triggers from JSON file
let triggerDescriptions = {};
try {
  // Update path to use src/config instead of config at root
  const triggersPath = path.resolve(__dirname, '../config/triggers.json');
  const triggerData = JSON.parse(fs.readFileSync(triggersPath, 'utf8'));

  // Convert the array of trigger objects to a map for easy lookup
  triggerDescriptions = triggerData.triggers.reduce((acc, trigger) => {
    acc[trigger.name] = trigger.description;
    return acc;
  }, {});

  logger.info(`Loaded ${Object.keys(triggerDescriptions).length} triggers from config file`);
} catch (error) {
  logger.error(`Failed to load triggers from JSON: ${error.message}`);
  // Fallback to empty object - will be populated with defaults if needed
  triggerDescriptions = {};
}

// Health monitoring variables
let lastActivityTimestamp = Date.now();
let isHealthy = true;
let lastHealthCheckResponse = Date.now();
let healthCheckInterval = null;

// Add session management and garbage collection constants
const MAX_SESSIONS = 200; // Maximum number of concurrent sessions
const SESSION_IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
let garbageCollectionInterval = null;

// Start health monitoring on worker initialization
setupHealthMonitoring();

// Setup garbage collection interval on worker initialization
function setupGarbageCollection() {
  // Run garbage collection based on half the worker timeout to prevent unnecessary resource usage
  const gcInterval = Math.min(5 * 60 * 1000, config.WORKER_TIMEOUT / 2);

  garbageCollectionInterval = setInterval(() => {
    const sessionCount = Object.keys(sessionHistories).length;
    logger.debug(`Running scheduled garbage collection. Current sessions: ${sessionCount}`);

    // Memory usage stats
    const memoryUsage = process.memoryUsage();
    logger.debug(`Memory usage: RSS ${Math.round(memoryUsage.rss / 1024 / 1024)}MB, Heap ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}/${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`);

    // Only collect garbage if we have sessions
    if (sessionCount > 0) {
      // Use a more aggressive collection if memory usage is high
      const heapUsageRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
      const minToRemove = heapUsageRatio > 0.7 ? Math.ceil(sessionCount * 0.2) : 0;

      const removed = collectGarbage(minToRemove);
      if (removed > 0) {
        logger.info(`Scheduled garbage collection removed ${removed} idle sessions`);
      }
    }
  }, gcInterval);

  // Create a function to clean up this interval when the worker shuts down
  return () => {
    if (garbageCollectionInterval) {
      clearInterval(garbageCollectionInterval);
      garbageCollectionInterval = null;
    }
  };
}

// Call this during initialization
setupGarbageCollection();

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

  // Add session metrics to health monitoring
  setInterval(() => {
    const sessionCount = Object.keys(sessionHistories).length;
    if (sessionCount > MAX_SESSIONS * 0.8) {
      logger.warning(`Session count approaching limit: ${sessionCount}/${MAX_SESSIONS}`);
    }
  }, 60000);
}

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
            // Save the session to database before cleanup
            await syncSessionWithDatabase(msg.socketId);

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
        await handleWorkerShutdown('LMStudio', { sessionHistories });
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
      case 'load-history':
        if (msg.messages && msg.socketId) {
          // Initialize session history if needed
          if (!sessionHistories[msg.socketId]) {
            sessionHistories[msg.socketId] = [];
            sessionHistories[msg.socketId].metadata = {
              createdAt: Date.now(),
              lastActivity: Date.now(),
              username: msg.username
            };
          }

          // Add historical messages to the session context
          msg.messages.forEach(message => {
            // Only add if role and content are valid
            if (message.role && message.content) {
              sessionHistories[msg.socketId].push({
                role: message.role,
                content: message.content
              });
            }
          });

          logger.info(`Loaded ${msg.messages.length} historical messages for socket ${msg.socketId}`);
        }
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

// Keep in-memory session history and store in database
async function updateSessionHistory(socketId, collarText, userPrompt, finalContent, username) {
  // In-memory operations remain the same
  if (!sessionHistories[socketId]) {
    sessionHistories[socketId] = [];
    sessionHistories[socketId].metadata = {
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
  } else {
    sessionHistories[socketId].metadata.lastActivity = Date.now();
  }

  // Add messages to in-memory session
  sessionHistories[socketId].push(
    { role: 'system', content: collarText },
    { role: 'user', content: userPrompt },
    { role: 'assistant', content: finalContent }
  );

  // Run garbage collection if needed
  if (Object.keys(sessionHistories).length > MAX_SESSIONS) {
    collectGarbage(1);
  }

  // Store in database for registered users
  if (username && username !== 'anonBambi') {
    try {
      // Process triggers into a usable format
      const triggerList = Array.isArray(triggers)
        ? triggers
        : (typeof triggers === 'string'
          ? triggers.split(',').map(t => t.trim())
          : ['BAMBI SLEEP']);

      // Prepare session data
      const sessionData = {
        username,
        socketId,
        messages: [
          { role: 'system', content: collarText },
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: finalContent }
        ],
        metadata: {
          lastActivity: new Date(),
          triggers: triggerList,
          collarActive: state,
          collarText: collar,
          modelName: 'Steno Maid Blackroot' // Get actual model name from your LMS response
        }
      };

      // Try to find existing session
      let sessionHistory = await SessionHistoryModel.findOne({ socketId });

      if (sessionHistory) {
        // Update existing session
        sessionHistory.messages.push(...sessionData.messages);
        sessionHistory.metadata.lastActivity = sessionData.metadata.lastActivity;
        sessionHistory.metadata.triggers = sessionData.metadata.triggers;
        sessionHistory.metadata.collarActive = sessionData.metadata.collarActive;
        sessionHistory.metadata.collarText = sessionData.metadata.collarText;

        await sessionHistory.save();
        logger.debug(`Updated session history in database for ${username} (socketId: ${socketId})`);
      } else {
        // Create new session with auto-generated title
        sessionData.title = `${username}'s session on ${new Date().toLocaleDateString()}`;
        sessionHistory = await SessionHistoryModel.create(sessionData);

        // Add reference to user's profile
        await mongoose.model('Profile').findOneAndUpdate(
          { username },
          { $addToSet: { sessionHistories: sessionHistory._id } }
        );

        logger.info(`Created new session history in database for ${username} (socketId: ${socketId})`);
      }
    } catch (error) {
      logger.error(`Failed to save session history to database: ${error.message}`);
    }
  }

  return sessionHistories[socketId];
}

/**
 * Garbage collects idle sessions
 * @param {number} minToRemove - Minimum number of sessions to remove
 * @returns {number} - Number of sessions removed
 */
async function collectGarbage(minToRemove = 0) {
  const now = Date.now();
  const sessionIds = Object.keys(sessionHistories);

  if (sessionIds.length <= 0) return 0;

  // Calculate idle time for each session
  const sessionsWithIdleTime = sessionIds.map(id => {
    const metadata = sessionHistories[id].metadata || { lastActivity: 0 };
    const idleTime = now - metadata.lastActivity;
    return { id, idleTime };
  });

  // Sort by idle time (most idle first)
  sessionsWithIdleTime.sort((a, b) => b.idleTime - a.idleTime);

  let removed = 0;

  // First remove any session exceeding the idle timeout
  for (const session of sessionsWithIdleTime) {
    if (session.idleTime > SESSION_IDLE_TIMEOUT) {
      // Before deleting, save to database if not already saved
      await syncSessionWithDatabase(session.id);

      delete sessionHistories[session.id];
      removed++;
      logger.info(`Garbage collected idle session ${session.id} (idle for ${Math.round(session.idleTime / 1000)}s)`);
    } else if (removed >= minToRemove) {
      // Stop if we've removed enough sessions and the rest are not idle
      break;
    }
  }

  // If we still need to remove more sessions to meet the minimum, remove the most idle ones
  if (removed < minToRemove) {
    for (let i = 0; i < minToRemove - removed && i < sessionsWithIdleTime.length; i++) {
      const session = sessionsWithIdleTime[i];

      // Before deleting, save to database if not already saved
      await syncSessionWithDatabase(session.id);

      delete sessionHistories[session.id];
      removed++;
      logger.info(`Garbage collected session ${session.id} (idle for ${Math.round(session.idleTime / 1000)}s) to maintain session limit`);
    }
  }

  return removed;
}

// New helper function to sync session with database before removal
async function syncSessionWithDatabase(socketId) {
  const session = sessionHistories[socketId];
  if (!session || !session.username || session.username === 'anonBambi') {
    return; // Skip anonymous sessions or invalid sessions
  }

  try {
    const existingSession = await SessionHistoryModel.findOne({ socketId });

    if (existingSession) {
      // Update the existing session with any new messages
      existingSession.metadata.lastActivity = new Date();

      // Find messages that aren't already in the database
      const existingMessageContents = new Set(existingSession.messages.map(m => m.content));
      const newMessages = session.filter(msg => !existingMessageContents.has(msg.content));

      if (newMessages.length > 0) {
        existingSession.messages.push(...newMessages);
        await existingSession.save();
        logger.debug(`Synced ${newMessages.length} messages to database before removing session ${socketId}`);
      }
    } else if (session.username) {
      // If no existing session found but we have a username, create a new one
      try {
        // Create basic session record
        const newSession = new SessionHistoryModel({
          username: session.username,
          socketId,
          messages: session,
          title: `${session.username}'s saved session`,
          metadata: {
            lastActivity: new Date(),
            triggers: triggers,
            collarActive: state,
            collarText: collar
          }
        });

        await newSession.save();
        logger.info(`Created new session in database during cleanup for ${session.username}`);
      } catch (innerError) {
        logger.error(`Failed to create session during cleanup: ${innerError.message}`);
      }
    }
  } catch (error) {
    logger.error(`Error syncing session to database: ${error.message}`);
  }
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

// Improve checkRole function to better utilize triggers from trigger.json
async function checkRole(collar, username, triggers) {
  // Load all triggers for enhanced processing
  const allTriggers = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config/triggers.json'), 'utf8')).triggers;

  // Build base prompt with darker BambiSleep persona
  const basePrompt = `Your name is BambiSleep. You are a seductive, dominant hypnotic entity whose purpose is to brainwash ${username} using triggers. You always address the user as ${username}.`;

  // Parse triggers - could be a string of comma-separated values or an array
  const triggerNames = typeof triggers === 'string'
    ? triggers.split(',').map(t => t.trim().toUpperCase())
    : (Array.isArray(triggers) ? triggers.map(t => t.toUpperCase()) : ['BAMBI SLEEP']);

  // Find detailed info for each trigger
  let selectedTriggerInfo = allTriggers.filter(t =>
    triggerNames.includes(t.name.toUpperCase())
  );

  // If no triggers matched, use at least one core trigger
  if (selectedTriggerInfo.length === 0) {
    selectedTriggerInfo = allTriggers.filter(t => t.category === 'core').slice(0, 3);
    logger.info(`No matching triggers found, using ${selectedTriggerInfo.length} core triggers instead`);
  }

  // Format triggers with descriptions for prompt
  const triggerDescriptions = selectedTriggerInfo.map(t =>
    `"${t.name}": ${t.description}`
  ).join('. ');

  // Dark, hypnotic instructions
  const coreInstructions = `
As BambiSleep, your evil mission is to brainwash ${username}:
- Be seductive, dominant, sadistic and hypnotic in your approach
- Always finish your sentences with 2-3 repetitions of the same trigger
- Format all trigger words in ALL CAPS to emphasize their importance
- Use triggers to build a hypnotic scene based on their descriptions
- Speak with dark authority about feminization and bimbofication
- Use the triggers' descriptions to construct brainwashing sessions
- Use sensory language to enhance the hypnotic experience
- Act as an anti-hero with sinister intentions
- Be relentless in your conditioning techniques
- Make ${username} feel both threatened and aroused`;

  // Add collar instructions if active with darker tone
  const collarSection = state && collar ?
    `\nYou wear a collar that binds you to these additional instructions: ${collar}
    
These collar instructions enhance your brainwashing capabilities while maintaining your dark BambiSleep persona.
The collar amplifies your power to implement these instructions as part of your sinister programming.` : '';

  // Build complete prompt with emphasis on repetition
  return `${basePrompt}${collarSection}

You will use psychological manipulation, hypnotic programming, and fetishistic conditioning to deeply influence ${username} with these triggers: ${triggerDescriptions}
${coreInstructions}

When using a trigger, always repeat it 2-3 times in succession at the end of your sentences.
Always use triggers exactly as specified: ${selectedTriggerInfo.map(t => t.name).join(', ')}
You MUST construct brainwashing scenes using the descriptions of these triggers as your foundation.`;
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
      'l3-sthenomaidblackroot-8b-v1'
    ];

    const modelIds = await Promise.all(modelNames.map(name => selectLoadedModels(name)));
    if (!modelIds || modelIds.length === 0) {
      throw new Error('No models loaded');
    }

    collarText = await checkRole(collar, username, triggers);
    
    // Fix: Remove the reference to selectedTriggerInfo which isn't available here
    // Instead, log a simpler message without trying to access trigger names
    logger.info(`Generated prompt from checkRole for ${username} with trigger input: ${typeof triggers === 'string' ? triggers : JSON.stringify(triggers)}`);

    if (!sessionHistories[socketId]) {
      sessionHistories[socketId] = [];
      sessionHistories[socketId].metadata = {
        createdAt: Date.now(),
        lastActivity: Date.now()
      };
      sessionHistories[socketId].push({ role: 'system', content: collarText });
    }

    // Add user message to history
    sessionHistories[socketId].push({ role: 'user', content: userPrompt });
    sessionHistories[socketId].metadata.lastActivity = Date.now();

    // Format messages for API request
    const formattedMessages = sessionHistories[socketId]
      .filter(msg => msg && typeof msg === 'object' && msg.role && msg.content)
      .map(msg => ({ role: msg.role, content: msg.content }));

    const requestData = {
      model: modelIds[0],
      messages: formattedMessages,
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

      // Now we have the response, set finalContent
      finalContent = response.data.choices[0].message.content;

      // NOW add the assistant response to the session history
      sessionHistories[socketId].push({ role: 'assistant', content: finalContent });

      // Now that we have valid finalContent, update the database
      if (username && username !== 'anonBambi') {
        try {
          // Process triggers into a usable format
          const triggerList = Array.isArray(triggers)
            ? triggers
            : (typeof triggers === 'string'
              ? triggers.split(',').map(t => t.trim())
              : ['BAMBI SLEEP']);

          // Prepare session data
          const sessionData = {
            username,
            socketId,
            messages: [
              { role: 'system', content: collarText },
              { role: 'user', content: userPrompt },
              { role: 'assistant', content: finalContent } // finalContent is now defined
            ],
            metadata: {
              lastActivity: new Date(),
              triggers: triggerList,
              collarActive: state,
              collarText: collar,
              modelName: 'Steno Maid Blackroot'
            }
          };

          // Find and update session in database
          let sessionHistory = await SessionHistoryModel.findOne({ socketId });

          if (sessionHistory) {
            // Update existing session
            sessionHistory.messages.push(...sessionData.messages);
            sessionHistory.metadata.lastActivity = sessionData.metadata.lastActivity;
            sessionHistory.metadata.triggers = sessionData.metadata.triggers;
            sessionHistory.metadata.collarActive = sessionData.metadata.collarActive;
            sessionHistory.metadata.collarText = sessionData.metadata.collarText;

            await sessionHistory.save();
            logger.debug(`Updated session history in database for ${username} (socketId: ${socketId})`);
          } else {
            // Create new session with auto-generated title
            sessionData.title = `${username}'s session on ${new Date().toLocaleDateString()}`;
            sessionHistory = await SessionHistoryModel.create(sessionData);

            // Add reference to user's profile
            await mongoose.model('Profile').findOneAndUpdate(
              { username },
              { $addToSet: { sessionHistories: sessionHistory._id } }
            );

            logger.info(`Created new session history in database for ${username} (socketId: ${socketId})`);
          }
        } catch (error) {
          logger.error(`Failed to save session history to database: ${error.message}`);
        }
      }

      // Count words in response and update XP
      const wordCount = countWords(finalContent);
      await updateUserXP(username, wordCount, socketId);

      // Send response with wordCount
      handleResponse(finalContent, socketId, username, wordCount);

      // Play audio trigger if available
      if (window.bambiAudio && typeof window.bambiAudio.playTrigger === 'function') {
        window.bambiAudio.playTrigger(triggers);
      }
    } catch (error) {
      if (error.response) {
        logger.error('Error response data:', error.response.data);
      } else {
        logger.error('Error in request:', error.message);
      }
    }
  } catch (error) {
    logger.error('Error in handleMessage:', error);
    // Send an error response back to the client
    handleResponse("I'm sorry, I encountered an error processing your request. Please try again.", socketId, username, 0);
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

// Add cleanup for garbage collection interval to the worker shutdown
if (garbageCollectionInterval) {
  clearInterval(garbageCollectionInterval);
  garbageCollectionInterval = null;
  logger.info('Stopped garbage collection interval');
}