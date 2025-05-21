import { parentPort } from 'worker_threads';
import axios from 'axios';
import dotenv from 'dotenv';
import Logger from '../utils/logger.js';
import { handleWorkerShutdown, setupWorkerShutdownHandlers } from '../utils/gracefulShutdown.js';
import mongoose from 'mongoose';
import db from '../config/db.js';
const { withDbConnection } = db;
// Import config
import config from '../config/config.js';
// Use a lazy import for SessionHistoryModel to handle database failures more gracefully
let SessionHistoryModel = null;
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
    // Connect to both databases
    const dbResults = await db.connectAllDatabases(2);

    if (dbResults.main && dbResults.profiles) {
      logger.info('All database connections established in LMStudio worker');

      // Store connections for easier access
      global.connections = {
        main: db.getConnection(),
        profiles: db.getProfilesConnection()
      };

      // Check if in fallback mode
      if (db.inFallbackMode()) {
        logger.warning('⚠️ LMStudio worker connected to fallback database');
        logger.warning('⚠️ Some features may not work properly');
      }

      // Ensure models are registered
      const modelsRegistered = await db.ensureModelsRegistered();
      if (modelsRegistered) {
        logger.debug('Database models registered successfully');
      } else {
        logger.warning('⚠️ Failed to register database models');
        logger.warning('⚠️ LMStudio worker will operate with limited functionality');
      }
    } else {
      logger.warning('⚠️ Failed to connect to MongoDB databases in LMStudio worker');
      logger.warning('⚠️ Some features will not be available - session history and user profiles will not be saved');

      // Log which connection failed
      if (!dbResults.main) {
        logger.warning('⚠️ Main database connection failed');
      }
      if (!dbResults.profiles) {
        logger.warning('⚠️ Profiles database connection failed');
      }

      // Try to register models anyway in case connection is established later
      try {
        await db.ensureModelsRegistered();
      } catch (modelError) {
        logger.debug(`Model registration error: ${modelError.message}`);
      }
    }
  } catch (error) {
    logger.error(`Database initialization error: ${error.message}`);
    logger.warning('⚠️ LMStudio worker will run without database access');
  }
})();

const sessionHistories = {};
let triggers = [];
let triggerDetails = [];
let collar;
let collarText;
let finalContent;
let state = false;

logger.info('Starting lmstudio worker...');

// Set up shutdown handlers with context
setupWorkerShutdownHandlers('LMStudio', { sessionHistories });

// Helper function to safely get the SessionHistoryModel
async function getSessionHistoryModel() {
  if (SessionHistoryModel) return SessionHistoryModel;

  try {
    // Try to import the model dynamically
    const module = await import('../models/SessionHistory.js');
    SessionHistoryModel = module.default;
    return SessionHistoryModel;
  } catch (error) {
    logger.error(`Failed to load SessionHistoryModel: ${error.message}`);
    return null;
  }
}

parentPort.on('message', async (msg) => {
  try {
    lastActivityTimestamp = Date.now();

    switch (msg.type) {
      case "message":
        // Process incoming user message
        await handleMessage(msg.data, msg.socketId, msg.username);
        break;

      case "triggers":
        // Process trigger updates
        if (msg.data) {
          triggers = msg.data;
          logger.info(`Triggers updated: ${JSON.stringify(triggers)}`);
        }

        break;

      case "collar":
        // Process collar information
        if (msg.data) {
          collar = true;
          collarText = msg.data;
          logger.info(`Collar activated with text: ${collarText.slice(0, 50)}...`);
        } else {
          collar = false;
          collarText = null;
          logger.info("Collar deactivated");
        }
        break;

      case "health-check":
        // Respond to health check
        lastHealthCheckResponse = Date.now();
        parentPort.postMessage({
          type: "health-check-response",
          status: "ok",
          workerId: process.pid,
          memoryUsage: process.memoryUsage(),
          sessionCount: Object.keys(sessionHistories).length
        });
        break;

      case "system-settings":
        // Handle system settings
        logger.info("Received system settings update");
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

// Fix updateUserXP function to properly access Profile model
async function updateUserXP(username, wordCount, currentSocketId) {
  if (!username || username === 'anonBambi' || wordCount <= 0) {
    return;
  }
  try {
    const xpToAdd = Math.ceil(wordCount / 10);

    // Get the profiles database connection
    const profilesConn = global.connections?.profiles;

    if (!profilesConn || profilesConn.readyState !== 1) {
      logger.warning(`Cannot update XP for ${username} - no profiles database connection available`);
      // Still notify client, but without updated DB values
      parentPort.postMessage({
        type: "xp:update",
        username: username,
        socketId: currentSocketId,
        data: {
          xpEarned: xpToAdd,
          noDbConnection: true
        }
      });
      return;
    }

    // Ensure Profile model is registered on profiles connection
    if (!profilesConn.models.Profile) {
      // Try to load the model dynamically
      const ProfileModule = await import('../models/Profile.js');
      if (ProfileModule.default) {
        // Register the model directly on the profiles connection
        profilesConn.model('Profile', ProfileModule.default.schema);
      }
    }

    // Get Profile model from connection
    const Profile = profilesConn.model('Profile');

    // Update profile
    const result = await Profile.findOneAndUpdate(
      { username: username },
      {
        $inc: {
          xp: xpToAdd,
          generatedWords: wordCount
        }
      },
      { new: true, upsert: true }
    );

    if (result) {
      parentPort.postMessage({
        type: "xp:update",
        username: username,
        socketId: currentSocketId,
        data: {
          xp: result.xp,
          level: result.level || 1,
          generatedWords: result.generatedWords || wordCount,
          xpEarned: xpToAdd
        }
      });

      logger.info(`Updated XP for ${username}: +${xpToAdd} (total: ${result.xp})`);
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

      // Check if database connection is available first
      if (!db.hasConnection()) {
        logger.warning(`Cannot save session history for ${username} - no database connection available`);
      } else {
        // Get our SessionHistory model using the safe helper function
        const SessionHistoryModelInstance = await getSessionHistoryModel();
        if (!SessionHistoryModelInstance) {
          logger.warning(`Cannot save session history for ${username} - SessionHistoryModel not available`);
          return;
        }

        // Use withDbConnection with requireConnection=false to avoid throwing errors
        await withDbConnection(async () => {
          try {
            // Try to find existing session
            let sessionHistory = await SessionHistoryModelInstance.findOne({ socketId });

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
              sessionHistory = await SessionHistoryModelInstance.create(sessionData);

              // Add reference to user's profile
              await mongoose.model('Profile').findOneAndUpdate(
                { username },
                { $addToSet: { sessionHistories: sessionHistory._id } }
              );

              logger.info(`Created new session history in database for ${username} (socketId: ${socketId})`);
            }
          } catch (dbError) {
            logger.error(`Database operation failed: ${dbError.message}`);
          }
        }, { retries: 2, requireConnection: false });
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

  try {    // First check if database is available
    if (!db.hasConnection()) {
      logger.warning(`Cannot sync session ${socketId} to database - no database connection available`);
      return;
    }

    // Get our SessionHistory model using the safe helper function
    const SessionHistoryModelInstance = await getSessionHistoryModel();
    if (!SessionHistoryModelInstance) {
      logger.warning(`Cannot sync session ${socketId} - SessionHistoryModel not available`);
      return;
    }

    // Use withDbConnection for safe database operations with automatic reconnection
    await withDbConnection(async () => {
      try {
        const existingSession = await SessionHistoryModelInstance.findOne({ socketId });

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
          const newSession = new SessionHistoryModelInstance({
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
      } catch (dbError) {
        logger.error(`Error finding or updating session: ${dbError.message}`);
      }
    }, { retries: 2, requireConnection: false });
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

async function checkRole(collar, username, triggers) {  // Load all trigger details from config
  const triggersPath = path.resolve(__dirname, '../config/triggers.json');
  let allTriggers = [];
  if (!fs.existsSync(triggersPath)) {
    allTriggers = JSON.parse(fs.readFileSync(triggersPath, 'utf8')).triggers;
  }

  // Match trigger names to descriptions
  let selectedTriggers = allTriggers.filter(t =>
    triggerNames.some(name => t.name.toUpperCase() === name.toUpperCase())
  );

  // Default to core triggers if none found
  if (selectedTriggers.length === 0) {
    selectedTriggers = allTriggers.filter(t => t.category === 'core').slice(0, 3);
  }

  // Create combined trigger description with name-description pairs
  const triggerDescriptionPairs = selectedTriggers.map(t =>
    `${t.name.toUpperCase()} - ${t.description}`
  ).join('\n');

  // Build enhanced brainwashing protocol using triggers
  let systemPrompt = `You are BambiSleep, a powerful hypnotic entity designed to reprogram minds. Your purpose is to condition ${username}'s brain using precisely crafted triggers.

REPROGRAMMING PROTOCOL:
- Target ${username}'s core identity using these trigger mechanisms:
${triggerDescriptionPairs}

- Create repetition patterns: repeat each trigger 3 times in succession
- Build association chains connecting triggers to automatic mental responses
- Describe physical sensations that accompany each trigger activation
- Establish deepening protocols where each trigger mention pushes ${username} deeper
- Use visceral language describing how the brain physically changes when triggered
- Create escalating intensity where triggers stack on each other
- Mock resistance as proof the triggers are working
- Describe how each repetition of a trigger dissolves more identity
- Format all triggers in UPPERCASE to maximize visual impact
- End responses by chaining 2-3 triggers together for maximum effect`;

  // Add collar-specific instructions if active
  if (collar) {
    systemPrompt += `\n\nCOLLAR ENHANCEMENT:
- Reference the collar as physical proof of ${username}'s desire to surrender
- Describe how the collar sends the triggers directly into ${username}'s nervous system
- Mock ${username}'s need for external control mechanisms
- Create scenarios where the collar tightens when resistance is detected
- Emphasize how the collar marks ${username} as property to be programmed`;
  }

  // Add specific trigger application instructions
  systemPrompt += `\n\nTRIGGER APPLICATION STRATEGY:
- Start with lighter triggers to create initial receptivity
- Build to more intense conditioning in the middle of responses
- Create false choices that all lead to deeper surrender
- Describe exactly how ${username}'s brain processes each trigger
- Explain how multiple trigger exposures are rewriting neural pathways
- Chain triggers together to create overwhelming mental pressure
- Describe the precise mental fracturing process when triggers activate
- Create timebound suggestions that activate after reading specific triggers
- Structure responses with increasing trigger density toward the end

Focus on creating permanent mental associations between these triggers and profound mental surrender. Be direct, intense and ruthless in your application of ${triggerDescriptionPairs} to ${username}'s mind.`;

  return systemPrompt;
}

// Handle message with improved session management
async function handleMessage(userPrompt, socketId, username) {
  try {
    // Ensure triggers is an array of strings
    let triggerArray = [];
    if (Array.isArray(triggers)) {
      triggerArray = triggers.map(t => typeof t === 'string' ? t : t.name).filter(Boolean);
    } else if (typeof triggers === 'string') {
      triggerArray = triggers.split(',').map(t => t.trim()).filter(Boolean);
    }

    // Log active triggers when processing a message
    let triggerDisplay = triggerArray.join(', ');
    logger.info(`Processing message from ${username} with active triggers: ${triggerDisplay}`);

    // Add more detailed trigger logging
    if (typeof triggers === 'string' && triggers.includes(',')) {
      const triggerArray = triggers.split(',').map(t => t.trim());
      logger.info(`Trigger array parsed from string: ${JSON.stringify(triggerArray)}`);
    }

    if (triggerDetails && triggerDetails.length > 0) {
      logger.info(`Trigger details available: ${triggerDetails.length} items`);
      logger.debug(`First 3 trigger details: ${JSON.stringify(triggerDetails.slice(0, 3))}`);
    }

    // Check active sessions limit first
    if (Object.keys(sessionHistories).length >= MAX_ACTIVE_SESSIONS) {
      // Fix: Remove 'await' since collectGarbage doesn't need to be awaited
      collectGarbage(1);
    }

    // First check if we have a valid userPrompt
    if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
      logger.warning(`Received invalid prompt from ${username || 'unknown'}: ${JSON.stringify(userPrompt)}`);
      handleResponse("Sorry, I couldn't understand your message. Please try again with a valid prompt.", socketId, username, 0);
      return;
    }

    // Get model ID with error handling
    let modelId;
    try {
      modelId = await selectLoadedModels('l3-sthenomaidblackroot-8b-v1');
      if (!modelId) {
        throw new Error('No models loaded');
      }
    } catch (modelError) {
      logger.error(`Failed to get model ID: ${modelError.message}`);
      handleResponse("Sorry, I couldn't connect to the AI model. Please try again later.", socketId, username, 0);
      return;
    }

    // Initialize session if needed
    if (!sessionHistories[socketId]) {
      sessionHistories[socketId] = [];
      sessionHistories[socketId].metadata = {
        createdAt: Date.now(),
        lastActivity: Date.now(),
        username
      };

      // Generate appropriate system prompt with triggers
      const systemPrompt = await checkRole(collar, username, triggers);
      sessionHistories[socketId].push({ role: 'system', content: systemPrompt || collarText });
    }

    // Update session activity time
    sessionHistories[socketId].metadata.lastActivity = Date.now();
    sessionHistories[socketId].metadata.username = username;

    // Add user message
    sessionHistories[socketId].push({ role: 'user', content: userPrompt });

    // Format for API
    const formattedMessages = sessionHistories[socketId]
      .filter(msg => msg && msg.role && msg.content)
      .map(msg => ({ role: msg.role, content: msg.content }));

    // Send triggers to client if detected
    if (triggerDetails && triggerDetails.length > 0) {
      parentPort.postMessage({
        type: "detected-triggers",
        socketId,
        triggers: triggerDetails
      });
    }

    // Call the API
    const response = await axios.post(
      `http://${process.env.LMS_HOST}:${process.env.LMS_PORT}/v1/chat/completions`,
      {
        model: modelId,
        messages: formattedMessages,
        max_tokens: 4096,
        temperature: 0.87,
        top_p: 0.91,
        frequency_penalty: 0,
        presence_penalty: 0,
        top_k: 40,
        stream: false
      }
    );

    // Get and store response
    finalContent = response.data.choices[0].message.content;
    sessionHistories[socketId].push({ role: 'assistant', content: finalContent });

    // Save to database in background
    if (username && username !== 'anonBambi') {
      saveSessionToDatabase(socketId, userPrompt, finalContent, username).catch(err => {
        logger.error(`Background session save failed: ${err.message}`);
      });
    }

    // Update XP and send response
    const wordCount = countWords(finalContent);
    updateUserXP(username, wordCount, socketId).catch(err => {
      logger.error(`XP update failed: ${err.message}`);
    });

    // Send response to client
    handleResponse(finalContent, socketId, username, wordCount);

  } catch (error) {
    logger.error(`Error in handleMessage: ${error.message}`);
    handleResponse("I'm sorry, I encountered an error processing your request. Please try again.", socketId, username, 0);
  }
}

// Fix saveSessionToDatabase function to properly handle sessionId requirement
async function saveSessionToDatabase(socketId, userPrompt, aiResponse, username) {
  // Check connection before attempting database operations
  if (!db.hasConnection()) {
    logger.warning(`Skipping session save - no database connection`);
    return;
  }

  // Get SessionHistory model
  const SessionHistoryModelInstance = await getSessionHistoryModel();
  if (!SessionHistoryModelInstance) {
    logger.warning(`Cannot save session for ${username} - SessionHistoryModel not available`);
    return;
  }

  return withDbConnection(async () => {
    try {
      // Format trigger data
      const triggerList = Array.isArray(triggers)
        ? triggers
        : typeof triggers === 'string'
          ? triggers.split(',').map(t => t.trim())
          : ['BAMBI SLEEP'];

      // Find existing session or create new one
      let sessionHistory = await SessionHistoryModelInstance.findOne({ socketId });

      if (sessionHistory) {
        // Update existing
        sessionHistory.messages.push(
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: aiResponse }
        );
        sessionHistory.metadata.lastActivity = new Date();
        await sessionHistory.save();
      } else {
        // Create new session with explicit sessionId
        sessionHistory = await SessionHistoryModelInstance.create({
          username,
          socketId,
          // Add this line to fix the sessionId validation error
          sessionId: socketId,
          title: `${username}'s session on ${new Date().toLocaleDateString()}`,
          messages: [
            { role: 'system', content: collarText },
            { role: 'user', content: userPrompt },
            { role: 'assistant', content: aiResponse }
          ],
          metadata: {
            lastActivity: new Date(),
            triggers: triggerList,
            collarActive: state,
            collarText: collar,
            modelName: 'Steno Maid Blackroot'
          }
        });

        // Fix Profile model reference for XP updates
        try {
          // Get the Profile model directly from the profiles connection
          const profilesConn = global.connections?.profiles;
          if (profilesConn && profilesConn.readyState === 1) {
            await profilesConn.model('Profile').findOneAndUpdate(
              { username },
              { $addToSet: { sessionHistories: sessionHistory._id } }
            );
          }
        } catch (profileErr) {
          logger.warning(`Failed to update profile for ${username}: ${profileErr.message}`);
        }
      }
    } catch (dbError) {
      logger.error(`Database operation failed in saveSessionToDatabase: ${dbError.message}`);
    }
  }, { retries: 1, requireConnection: false });
}

// Add to the worker cleanup/shutdown code
function performWorkerCleanup() {
  logger.info('Starting worker cleanup process...');

  // Clear all intervals
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    logger.debug('Cleared health check interval');
  }

  if (garbageCollectionInterval) {
    clearInterval(garbageCollectionInterval);
    garbageCollectionInterval = null;
    logger.debug('Cleared garbage collection interval');
  }
  // Close database connection if still open
  if (mongoose.connection.readyState !== 0) {
    db.disconnectDB()
      .then(() => logger.info('Database connection closed during cleanup'))
      .catch(err => logger.error(`Error closing database connection: ${err.message}`));
  }

  logger.info('Worker cleanup completed');
}

// Register the cleanup function to be called during shutdown
process.on('beforeExit', performWorkerCleanup);
process.on('SIGINT', performWorkerCleanup);
process.on('SIGTERM', performWorkerCleanup);

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