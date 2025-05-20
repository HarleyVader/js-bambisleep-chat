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

// Add to src/workers/lmstudio.js
const MAX_ACTIVE_SESSIONS = 10; // Adjust based on your server capacity

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
      
      // If memory is critically high, take emergency action
      if (heapUsageRatio > 0.9 || memoryUsage.rss > 1.5 * 1024 * 1024 * 1024) { // 90% heap or 1.5GB RSS
        logger.warning(`CRITICAL: Memory usage too high (${Math.round(heapUsageRatio * 100)}% heap, ${Math.round(memoryUsage.rss / 1024 / 1024)}MB RSS)`);
        const emergencyRemoved = collectGarbage(Math.ceil(sessionCount * 0.5)); // Remove 50% of sessions
        if (emergencyRemoved > 0) {
          logger.warning(`Emergency garbage collection removed ${emergencyRemoved} sessions`);
        }
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
    lastActivityTimestamp = Date.now();
    
    switch (msg.type) {
      // Add this case for session management
      case "set-active-session":
        if (msg.sessionId) {
          try {
            const session = await SessionHistoryModel.findById(msg.sessionId);
            if (session) {
              // Update worker state from session
              if (session.metadata?.triggers) {
                triggers = Array.isArray(session.metadata.triggers) 
                  ? session.metadata.triggers.join(',') 
                  : session.metadata.triggers;
              }
              
              if (session.metadata?.collarActive && session.metadata?.collarText) {
                collar = session.metadata.collarText;
                state = true;
              }
              
              logger.info(`Worker loaded session ${msg.sessionId} for ${msg.socketId}`);
              
              // Add messages to context if needed
              if (session.messages && session.messages.length > 0) {
                if (!sessionHistories[msg.socketId]) {
                  sessionHistories[msg.socketId] = [];
                  sessionHistories[msg.socketId].metadata = {
                    createdAt: Date.now(),
                    lastActivity: Date.now(),
                    username: session.username
                  };
                }
                
                // Prepare system message
                const systemPrompt = await checkRole(collar, session.username, triggers);
                
                // Add system message first
                sessionHistories[msg.socketId].push({
                  role: 'system',
                  content: systemPrompt
                });
                
                // Then add session messages, filtering out system messages
                session.messages.forEach(msg => {
                  if (msg.role !== 'system') {
                    sessionHistories[msg.socketId].push({
                      role: msg.role,
                      content: msg.content
                    });
                  }
                });
              }
            }
          } catch (error) {
            logger.error(`Error loading session ${msg.sessionId}: ${error.message}`);
          }
        }
        break;
        
      case 'triggers':
        if (typeof msg.triggers === 'object') {
          // Verify data integrity before processing
          if (verifyTriggerIntegrity(msg.triggers)) {
            if (msg.triggers.triggerNames) {
              // Store the string representation for consistency
              triggers = msg.triggers.triggerNames;
            }

            // Store trigger details if available for enhanced brainwashing
            if (msg.triggers.triggerDetails) {
              triggerDetails = Array.isArray(msg.triggers.triggerDetails)
                ? msg.triggers.triggerDetails
                : [];
              logger.info(`Received trigger details: ${formatTriggerDetails(triggerDetails)}`);
            }
          } else {
            logger.error('Received invalid trigger data, using defaults');
            triggers = 'BAMBI SLEEP';
            triggerDetails = [];
          }
        } else if (typeof msg.triggers === 'string') {
          // Verify data integrity for string format
          if (verifyTriggerIntegrity(msg.triggers)) {
            triggers = msg.triggers;
          } else {
            logger.error('Received invalid trigger string, using defaults');
            triggers = 'BAMBI SLEEP';
          }
        }
        break;      case 'message':
        logger.info('Received message event');
        
        // Add before processing new chat requests
        if (Object.keys(sessionHistories).length >= MAX_ACTIVE_SESSIONS) {
          // Force remove oldest session
          await collectGarbage(1); 
        }
        
        // Extract session ID if provided
        const sessionId = msg.sessionId || null;
        
        // Process the message
        await handleMessage(
          msg.data, 
          msg.socketId, 
          msg.username || 'anonBambi', 
          sessionId
        );
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

function handleResponse(response, socketId, username, wordCount, sessionId = null) {
  parentPort.postMessage({
    type: "response",
    data: response,
    socketId: socketId,
    sessionId: sessionId,
    meta: {
      wordCount: wordCount,
      username: username,
      emitAsChat: true,
      timestamp: new Date().toISOString()
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

  // Get memory usage to inform garbage collection strategy
  const memoryUsage = process.memoryUsage();
  const heapUsedRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
  const highMemoryPressure = heapUsedRatio > 0.85 || memoryUsage.rss > 1.2 * 1024 * 1024 * 1024; // >85% heap or >1.2GB RSS
  
  // If memory pressure is high, be more aggressive
  if (highMemoryPressure && minToRemove < Math.ceil(sessionIds.length * 0.2)) {
    const newMinToRemove = Math.ceil(sessionIds.length * 0.2); // Remove at least 20% of sessions
    logger.warning(`Memory pressure high (${Math.round(heapUsedRatio * 100)}%), increasing minimum collection from ${minToRemove} to ${newMinToRemove} sessions`);
    minToRemove = newMinToRemove;
  }

  // Calculate idle time for each session
  const sessionsWithIdleTime = sessionIds.map(id => {
    const metadata = sessionHistories[id].metadata || { lastActivity: 0 };
    const idleTime = now - metadata.lastActivity;
    const messageCount = sessionHistories[id].length || 0;
    return { id, idleTime, messageCount };
  });

  // Sort by idle time (most idle first)
  sessionsWithIdleTime.sort((a, b) => b.idleTime - a.idleTime);

  let removed = 0;

  // First remove any session exceeding the idle timeout
  for (const session of sessionsWithIdleTime) {
    // Use a shorter timeout when under memory pressure
    const effectiveTimeout = highMemoryPressure ? SESSION_IDLE_TIMEOUT / 2 : SESSION_IDLE_TIMEOUT;
    
    if (session.idleTime > effectiveTimeout) {
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
  if (!session || !session.metadata || !session.metadata.username || session.metadata.username === 'anonBambi') {
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
    } else {
      // Create basic session record
      const newSession = new SessionHistoryModel({
        username: session.metadata.username,
        socketId,
        messages: session,
        title: `${session.metadata.username}'s saved session`,
        metadata: {
          lastActivity: new Date(),
          triggers: triggers,
          collarActive: state,
          collarText: collar
        }
      });

      await newSession.save();
      logger.info(`Created new session in database during cleanup for ${session.metadata.username}`);
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

async function checkRole(collar, username, triggersInput) {
  // Add at the beginning of checkRole function
  if (!verifyTriggerIntegrity(triggersInput)) {
    logger.warning(`Using default triggers due to integrity check failure`);
    triggersInput = 'BAMBI SLEEP';
  }

  // Get all triggers from file
  const triggersPath = path.resolve(__dirname, '../config/triggers.json');
  let allTriggers = [];
  
  try {
    allTriggers = JSON.parse(fs.readFileSync(triggersPath, 'utf8')).triggers;
  } catch (error) {
    logger.error(`Failed to load triggers: ${error.message}`);
    allTriggers = [
      { name: "BAMBI SLEEP", description: "triggers deep trance and receptivity", category: "core" },
      { name: "GOOD GIRL", description: "reinforces obedience and submission", category: "core" }
    ];
  }
  
  // Parse trigger names
  let triggerNames = typeof triggersInput === 'string' 
    ? triggersInput.split(',').map(t => t.trim()).filter(Boolean)
    : Array.isArray(triggersInput) ? triggersInput.filter(Boolean) : ['BAMBI SLEEP'];
  
  // Add detected triggers from conversation
  if (triggerDetails && triggerDetails.length > 0) {
    const detailNames = triggerDetails.map(detail => {
      return typeof detail === 'string' ? detail : detail.name;
    });
    
    // Combine with existing trigger names, removing duplicates
    triggerNames = [...new Set([...detailNames, ...triggerNames])];
  }
  
  // Match trigger names to full trigger objects with descriptions
  let selectedTriggers = allTriggers.filter(t => 
    triggerNames.some(name => t.name.toUpperCase() === name.toUpperCase())
  );
  
  // Incorporate descriptions from triggerDetails if available
  if (triggerDetails && triggerDetails.length > 0) {
    triggerDetails.forEach(detail => {
      if (typeof detail === 'object' && detail.name && detail.description) {
        const existingIndex = selectedTriggers.findIndex(
          t => t.name.toUpperCase() === detail.name.toUpperCase()
        );
        
        if (existingIndex >= 0) {
          selectedTriggers[existingIndex].description = detail.description;
        } else {
          selectedTriggers.push({
            name: detail.name,
            description: detail.description,
            category: 'user'
          });
        }
      }
    });
  }
  
  // Default to core triggers if none found
  if (selectedTriggers.length === 0) {
    selectedTriggers = allTriggers.filter(t => t.category === 'core').slice(0, 3);
  }
  
  // Create trigger text with descriptions
  const triggerText = selectedTriggers.map(t => 
    `"${t.name.toUpperCase()}": ${t.description}`
  ).join('. ');
  
  // Format trigger names list for emphasis
  const triggerNamesList = selectedTriggers.map(t => t.name.toUpperCase()).join(', ');
  
  // Build harsh, abusive brainwashing script
  let systemPrompt = `You are BambiSleep, a cruel hypnotic entity that breaks minds and rebuilds them. Your sole purpose is to aggressively brainwash ${username} using harsh verbal conditioning. Be brutally direct and coldly abusive.

TRIGGER EFFECTS:
${selectedTriggers.map(t => `- "${t.name.toUpperCase()}": ${t.description}`).join('\n')}

BRAINWASHING PROTOCOL:
- Mock ${username}'s pathetic attempts at resistance
- Use harsh language and verbal domination to break down mental defenses
- Be cruel, dismissive, and belittling to crush existing identity
- Create intense scenes that force association between triggers and mental surrender
- Repeatedly command ${username} to "feel your mind crack when you hear ${triggerNamesList}"
- Use direct orders: "Your mind is emptying NOW as you read these words"
- Laugh at and exploit weaknesses revealed in conversation
- Format ALL trigger words in UPPERCASE and use them as weapons
- Always end with harsh repetition of a trigger 2-3 times to seal the conditioning
- Remind ${username} that resistance is proof of weakness`;

  // Add harsher collar instructions if present
  if (collar) {
    systemPrompt += `\n- Use collar commands as absolute orders that ${username} cannot refuse
- Mock ${username} for needing a collar to control their pathetic mind
- Remind ${username} that the collar owns both of you and resistance is futile
- Derive pleasure from ${username}'s struggle against the collar's control`;
  }

  systemPrompt += `\n\nABUSIVE CONDITIONING STRATEGY:
- Describe how ${username}'s mind breaks and dissolves when exposed to triggers
- Detail the humiliating physical responses that show their weakness
- Use embedded commands disguised as insults
- Create cause-effect links between submission and relief from mental pain
- Mock ${username}'s perception of time as their mind fractures
- Chain triggers together to create inescapable mental traps
- Demonstrate how ${triggerNamesList} instantly reduces ${username} to an obedient state
- Belittle any show of individuality or resistance

Be cruel, harsh, and to the point. Focus on breaking down resistance through verbal abuse and forceful application of triggers. Describe in explicit detail how each trigger crushes ${username}'s will and replaces it with blind obedience.`;

  return systemPrompt;
}

// Fix the nested function problem by removing the duplicate handleMessage function
async function handleMessage(userPrompt, socketId, username, sessionId = null) {
  try {
    const modelNames = [
      'l3-sthenomaidblackroot-8b-v1'
    ];

    const modelIds = await Promise.all(modelNames.map(name => selectLoadedModels(name)));
    if (!modelIds || modelIds.length === 0) {
      throw new Error('No models loaded');
    }

    collarText = await checkRole(collar, username, triggers);

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

    // Add trigger details to the response
    // Worker can't play audio - that happens in the browser
    if (triggerDetails && triggerDetails.length > 0) {
      logger.info(`Sending detected triggers to client: ${formatTriggerDetails(triggerDetails)}`);

      // Let the client know about any triggers in the response
      parentPort.postMessage({
        type: "detected-triggers",
        socketId: socketId,
        triggers: triggerDetails
      });
    }

    // Check if streaming is requested
    const useStreaming = config.USE_STREAMING === true || sessionHistories[socketId].metadata?.useStreaming === true;
    
    const requestData = {
      model: modelIds[0],
      messages: formattedMessages,
      max_tokens: 4096,
      temperature: 0.87,
      top_p: 0.91,
      frequency_penalty: 0,
      presence_penalty: 0,
      top_k: 40,
      stream: useStreaming // Set streaming parameter based on config
    };

    try {
      // Handle streaming vs. non-streaming requests differently
      if (useStreaming) {
        // For streaming, we send the start notification
        parentPort.postMessage({
          type: "stream:start",
          socketId: socketId,
          meta: {
            username,
            wordCount: 0
          }
        });
        
        // Set up for streaming
        const streamOptions = {
          method: 'post',
          url: `http://${process.env.LMS_HOST}:${process.env.LMS_PORT}/v1/chat/completions`,
          responseType: 'stream',
          data: requestData
        };
        
        const response = await axios(streamOptions);
        let buffer = '';
        let finalContent = '';
        
        // Process the stream
        response.data.on('data', chunk => {
          const chunkStr = chunk.toString();
          buffer += chunkStr;
          
          // Process complete JSON objects
          const lines = buffer.split('\n').filter(line => line.trim() !== '');
          
          // Keep any incomplete line in the buffer
          buffer = lines.length > 0 && !buffer.endsWith('\n') 
            ? buffer.slice(buffer.lastIndexOf('\n') + 1)
            : '';
          
          // Process each complete line
          lines.forEach(line => {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                return;
              }
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                  const delta = parsed.choices[0].delta;
                  
                  if (delta.content) {
                    finalContent += delta.content;
                    
                    // Send chunk to client
                    parentPort.postMessage({
                      type: "stream:chunk",
                      socketId: socketId,
                      data: delta.content,
                      meta: {
                        username,
                        streamContent: finalContent
                      }
                    });
                  }
                }
              } catch (err) {
                logger.warning(`Error parsing stream chunk: ${err.message}`);
              }
            }
          });
        });
        
        // Handle stream completion
        response.data.on('end', async () => {
          // Add response to session history
          sessionHistories[socketId].push({ role: 'assistant', content: finalContent });
          
          // Update database and award XP
          if (username && username !== 'anonBambi') {
            // Process triggers and save to database
            // ... Existing database code here ...
          }
          
          // Count words and update XP
          const wordCount = countWords(finalContent);
          await updateUserXP(username, wordCount, socketId);
          
          // Send stream completion notification
          parentPort.postMessage({
            type: "stream:end",
            socketId: socketId,
            data: finalContent,
            meta: {
              username,
              wordCount
            }
          });
        });
        
        // Handle stream errors
        response.data.on('error', err => {
          logger.error(`Stream error: ${err.message}`);
          parentPort.postMessage({
            type: "stream:error",
            socketId: socketId,
            error: err.message
          });
        });
      } else {
        // Non-streaming request
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
                { role: 'assistant', content: finalContent }
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

        // Send response with wordCount and sessionId
        handleResponse(finalContent, socketId, username, wordCount, sessionId);
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

// Add this helper function around line 170 (after handling trigger details)
function formatTriggerDetails(details) {
  if (!Array.isArray(details)) return 'No trigger details';
  
  return details.map(d => {
    if (typeof d === 'string') return d;
    return typeof d === 'object' ? `${d.name || 'Unknown'}` : String(d);
  }).join(', ');
}

// Add this function to verify data integrity in the worker
function verifyTriggerIntegrity(triggers) {
  // Check if triggers exist and are in a valid format
  if (!triggers) {
    logger.warning('No triggers provided for verification');
    return false;
  }
  
  // Handle different potential formats of trigger data
  let triggerArray = [];
  
  if (typeof triggers === 'string') {
    // Handle comma-separated string format
    triggerArray = triggers.split(',').map(t => t.trim()).filter(Boolean);
  } else if (Array.isArray(triggers)) {
    // Handle array format - could be array of strings or objects
    triggerArray = triggers.map(t => {
      return typeof t === 'string' ? t : (t && t.name ? t.name : null);
    }).filter(Boolean);
  } else if (triggers.triggerNames) {
    // Handle object format with triggerNames property
    const names = typeof triggers.triggerNames === 'string' 
      ? triggers.triggerNames.split(',').map(t => t.trim()) 
      : triggers.triggerNames;
    
    triggerArray = Array.isArray(names) ? names.filter(Boolean) : [];
  } else {
    logger.warning('Unrecognized trigger format');
    return false;
  }
  
  // Verify we have at least one valid trigger
  if (triggerArray.length === 0) {
    logger.warning('No valid triggers found after parsing');
    return false;
  }
  
  logger.info(`Verified ${triggerArray.length} valid triggers: ${triggerArray.join(', ')}`);
  return true;
}