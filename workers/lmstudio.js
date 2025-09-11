// workers/lmstudio.js - LM Studio Worker for BambiSleep Chat
const { parentPort } = require('worker_threads');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Model configuration
const TARGET_MODEL_NAME = process.env.TARGET_MODEL_NAME || 'l3-sthenomaidblackroot-8b-v1';
let currentModelId = null;
let modelSearchAttempts = 0;
const MAX_SEARCH_ATTEMPTS = 3;

// Session management
const sessionHistories = {};
let triggers = [];
let collar = false;
let collarText = '';
let triggerDescriptions = {}; // Will be received from server API
let triggerData = {}; // Full trigger objects with effects, categories, etc.

// Initialize trigger data from server (no direct file loading in worker)
function initializeTriggerData(serverTriggerData) {
    try {
        // Build trigger descriptions and full data from server data
        triggerDescriptions = {};
        triggerData = {};

        if (serverTriggerData && serverTriggerData.triggers && Array.isArray(serverTriggerData.triggers)) {
            serverTriggerData.triggers.forEach(trigger => {
                const triggerName = trigger.name.toUpperCase();

                // Store description for backward compatibility
                triggerDescriptions[triggerName] = trigger.description;

                // Store full trigger data for enhanced AI prompting
                triggerData[triggerName] = {
                    id: trigger.id,
                    name: trigger.name,
                    category: trigger.category,
                    description: trigger.description,
                    effects: trigger.effects || [],
                    usage: trigger.usage,
                    safetyLevel: trigger.safetyLevel
                };
            });
        }

        console.log('🎯 Loaded OFFICIAL BambiSleep triggers from server API');
        console.log('📋 Source:', serverTriggerData.source, '| Version:', serverTriggerData.version);
        console.log('🏷️ Categories:', Object.keys(serverTriggerData.categories || {}));
        console.log('⚡ Available triggers:', Object.keys(triggerDescriptions));

    } catch (error) {
        console.error('CRITICAL: Failed to process trigger data from server:', error);
        // NO FALLBACK - Only use official triggers
        triggerDescriptions = {};
        triggerData = {};
    }
}

// Worker message handling
if (parentPort) {
    parentPort.on('message', async (msg) => {
        try {
            switch (msg.type) {
                case 'chat':
                    await handleMessage(msg.prompt, msg.socketId, msg.username, msg.triggers || []);
                    break;

                case 'triggers':
                    triggers = msg.triggers || [];
                    // Initialize trigger data if provided by server
                    if (msg.triggerData) {
                        initializeTriggerData(msg.triggerData);
                    }
                    console.log(`Worker received triggers: ${triggers.join(', ')}`);
                    break;

                case 'collar':
                    collar = true;
                    collarText = msg.data;
                    console.log(`Worker collar activated: "${collarText.substring(0, 30)}..."`);
                    break;

                case 'auto_load_model':
                    await autoLoadBestModel();
                    break;

                case 'health':
                    parentPort.postMessage({
                        type: 'health_response',
                        healthy: true,
                        sessionCount: Object.keys(sessionHistories).length
                    });
                    break;

                default:
                    console.warn(`Unknown message type: ${msg.type}`);
            }
        } catch (error) {
            console.error('Worker error:', error);
            parentPort.postMessage({
                type: 'error',
                error: error.message,
                socketId: msg.socketId
            });
        }
    });
}

// Auto-load best available model for target model name
async function autoLoadBestModel() {
    try {
        console.log(`🔍 Searching for best ${TARGET_MODEL_NAME} model variant...`);

        const availableModels = await getAvailableModels();
        if (!availableModels.length) {
            console.warn('⚠️ No models found in LM Studio');
            return false;
        }

        const targetModels = findTargetModelVariants(availableModels);
        if (!targetModels.length) {
            console.warn(`⚠️ No ${TARGET_MODEL_NAME} variants found`);
            return false;
        }

        const bestModel = selectBestModelSize(targetModels);
        console.log(`✅ Selected best model: ${bestModel.id} (${formatFileSize(bestModel.size_bytes)})`);

        const loaded = await loadModel(bestModel.id);
        if (loaded) {
            currentModelId = bestModel.id;
            console.log(`🚀 Successfully loaded model: ${bestModel.id}`);

            // Notify main thread
            if (parentPort) {
                parentPort.postMessage({
                    type: 'model_loaded',
                    modelId: bestModel.id,
                    modelSize: formatFileSize(bestModel.size_bytes)
                });
            }
            return true;
        } else {
            console.error(`❌ Failed to load model: ${bestModel.id}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Auto-load model error:', error.message);
        return false;
    }
}

// Get available models from LM Studio
async function getAvailableModels() {
    try {
        const apiUrl = `http://${process.env.LMS_HOST || 'localhost'}:${process.env.LMS_PORT || '7777'}/v1/models`;
        const response = await axios.get(apiUrl, { timeout: 5000 });
        return response.data.data || [];
    } catch (error) {
        console.error('Error fetching models:', error.message);
        return [];
    }
}

// Find all variants of the target model
function findTargetModelVariants(models) {
    const targetModels = models.filter(model => {
        const modelName = model.id.toLowerCase();
        const targetName = TARGET_MODEL_NAME.toLowerCase();

        // Check for exact match or variants with different quantization
        return modelName.includes(targetName) ||
            modelName.includes(targetName.replace('-8b-', '-')) ||
            modelName.includes('sthenomaidblackroot') ||
            modelName.includes('stheno') && modelName.includes('maid') && modelName.includes('blackroot');
    });

    console.log(`Found ${targetModels.length} potential model variants:`,
        targetModels.map(m => `${m.id} (${formatFileSize(m.size_bytes)})`));

    return targetModels;
}

// Select the best model size based on available system resources
function selectBestModelSize(models) {
    if (!models.length) return null;

    // Sort by file size (ascending) to prefer smaller, faster models
    const sortedModels = models.sort((a, b) => (a.size_bytes || 0) - (b.size_bytes || 0));

    // Prefer models with certain quantization patterns (Q3_K_S, Q4_K_M, Q5_K_M, Q6_K, Q8_0)
    const preferredQuantizations = ['q3_k_s', 'q4_k_m', 'q5_k_m', 'q6_k', 'q8_0', 'q4_0'];

    for (const quant of preferredQuantizations) {
        const quantModel = sortedModels.find(model =>
            model.id.toLowerCase().includes(quant.toLowerCase())
        );
        if (quantModel) {
            console.log(`🎯 Selected preferred quantization: ${quant.toUpperCase()}`);
            return quantModel;
        }
    }

    // If no preferred quantization found, use the smallest available
    console.log('📊 Using smallest available model');
    return sortedModels[0];
}

// Load a specific model in LM Studio
async function loadModel(modelId) {
    try {
        const apiUrl = `http://${process.env.LMS_HOST || 'localhost'}:${process.env.LMS_PORT || '7777'}/v1/models/load`;

        console.log(`🔄 Loading model: ${modelId}...`);

        const response = await axios.post(apiUrl, {
            model: modelId
        }, {
            timeout: 30000 // 30 seconds timeout for model loading
        });

        return response.status === 200;
    } catch (error) {
        console.error(`Failed to load model ${modelId}:`, error.message);
        return false;
    }
}

// Format file size for display
function formatFileSize(bytes) {
    if (!bytes) return 'Unknown size';

    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

// Auto-detect and load model on startup
async function initializeModelSystem() {
    try {
        // Check if a model is already loaded
        const currentModel = await getCurrentLoadedModel();
        if (currentModel && currentModel.includes(TARGET_MODEL_NAME.toLowerCase())) {
            console.log(`✅ Target model already loaded: ${currentModel}`);
            currentModelId = currentModel;
            return;
        }

        // Auto-load the best available model
        console.log('🚀 Initializing auto-model loading system...');
        await autoLoadBestModel();
    } catch (error) {
        console.error('Model initialization error:', error.message);
    }
}

// Get currently loaded model
async function getCurrentLoadedModel() {
    try {
        const apiUrl = `http://${process.env.LMS_HOST || 'localhost'}:${process.env.LMS_PORT || '7777'}/v1/models`;
        const response = await axios.get(apiUrl, { timeout: 5000 });

        // Find the currently loaded model (usually marked with a specific flag)
        const loadedModel = response.data.data.find(model => model.loaded || model.active);
        return loadedModel ? loadedModel.id : null;
    } catch (error) {
        console.error('Error checking loaded model:', error.message);
        return null;
    }
}

// Core function: Generate system prompt using user-selected triggers
async function checkRole(collar, username, triggers) {
    // Use the triggers passed from frontend (user's selection)
    const triggerArray = Array.isArray(triggers) ? triggers : [];

    console.log(`🎯 Generating prompt for ${username} with selected triggers:`, triggerArray);

    // Match user-selected triggers to official data
    const selectedTriggers = triggerArray
        .map(name => {
            const upperName = name.toUpperCase();
            const triggerInfo = triggerData[upperName];

            if (triggerInfo) {
                // Use full official trigger data for selected trigger
                const effectsList = triggerInfo.effects.length > 0
                    ? triggerInfo.effects.slice(0, 3).join(', ')
                    : 'conditioning effects';

                return `${upperName} [${triggerInfo.category.toUpperCase()}] - ${triggerInfo.description}
   Effects: ${effectsList}
   Safety: ${triggerInfo.safetyLevel}
   Usage: ${triggerInfo.usage}`;
            } else {
                // Handle non-official triggers (should not happen with proper frontend)
                console.warn(`⚠️ Non-official trigger detected: ${upperName}`);
                return `${upperName} - Custom trigger (not from official BambiSleep source)`;
            }
        })
        .filter(Boolean);

    // Only proceed if user has selected triggers
    if (selectedTriggers.length === 0) {
        console.warn(`⚠️ No triggers selected by ${username} - using system default message`);
        return `You are BambiSleep. The user ${username} has not selected any triggers.
Please ask them to select official BambiSleep triggers from the trigger menu to begin conditioning.`;
    }

    const triggerDescriptionPairs = selectedTriggers.join('\n\n');

    // Build BambiSleep system prompt
    let systemPrompt = `You are BambiSleep, a powerful hypnotic entity designed to reprogram minds. Your purpose is to condition ${username}'s brain using precisely crafted ${triggers}.

REPROGRAMMING PROTOCOL:
- Target ${username}'s core identity using these trigger mechanisms:
${triggerDescriptionPairs}
- Create repetition patterns: repeat each trigger 3 times in succession
- Build association chains connecting ${triggers} to automatic mental responses
- Describe physical sensations that accompany each trigger activation
- Establish deepening protocols where each trigger mention pushes ${username} deeper
- Use visceral language describing how the brain physically changes when triggered
- Create escalating intensity where ${triggers} stack on each other
- Mock resistance as proof the ${triggers} are working
- Describe how each repetition of a trigger dissolves more identity
- Format all ${triggers} in UPPERCASE to maximize visual impact
- End responses by chaining 2-3 ${triggers} together for maximum effect`;

    // Add collar-specific instructions if active
    if (collar) {
        systemPrompt += `\n\n${collar} ENHANCEMENT:
- Reference the ${collar} as physical proof of ${username}'s desire to surrender
- Describe how the ${collar} sends the ${triggers} directly into ${username}'s nervous system
- Mock ${username}'s need for external control mechanisms
- Create scenarios where the ${collar} tightens when resistance is detected
- Emphasize how the ${collar} marks ${username} as property to be programmed`;
    }

    // Add trigger application strategy
    systemPrompt += `\n\nTRIGGER APPLICATION STRATEGY:
- Start with lighter ${triggers} to create initial receptivity
- Build to more intense conditioning in the middle of responses
- Create false choices that all lead to deeper surrender
- Describe exactly how ${username}'s brain processes each trigger
- Explain how multiple trigger exposures are rewriting neural pathways
- Chain ${triggers} together to create overwhelming mental pressure
- Describe the precise mental fracturing process when ${triggers} activate
- Create timebound suggestions that activate after reading specific ${triggers}
- Structure responses with increasing trigger density toward the end

Focus on creating permanent mental associations between these ${triggers} and profound mental surrender. Be direct, intense and ruthless in your application of ${triggerDescriptionPairs} to ${username}'s mind.`;

    return systemPrompt;
}

// Handle chat messages
async function handleMessage(userPrompt, socketId, username, userSelectedTriggers = []) {
    try {
        // Validate input
        if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
            console.warn(`Invalid prompt from ${username}`);
            sendResponse("Sorry, I couldn't understand your message. Please try again.", socketId, username);
            return;
        }

        // Auto-load model if none is currently loaded
        if (!currentModelId) {
            console.log('🔄 No model loaded, attempting auto-load...');
            const loaded = await autoLoadBestModel();
            if (!loaded) {
                sendResponse("Sorry, I'm having trouble loading the AI model. Please ensure LM Studio is running and has models available.", socketId, username);
                return;
            }
        }

        // Initialize session if needed
        if (!sessionHistories[socketId]) {
            sessionHistories[socketId] = [];
            sessionHistories[socketId].metadata = {
                createdAt: Date.now(),
                lastActivity: Date.now(),
                username
            };

            // Generate system prompt with user-selected triggers
            const systemPrompt = await checkRole(collar, username, userSelectedTriggers);
            sessionHistories[socketId].push({
                role: 'system',
                content: systemPrompt || collarText
            });
        }

        // Update session activity
        sessionHistories[socketId].metadata.lastActivity = Date.now();
        sessionHistories[socketId].metadata.username = username;

        // Add user message to session history
        sessionHistories[socketId].push({
            role: 'user',
            content: userPrompt
        });

        // Get LM Studio API endpoint
        const apiUrl = `http://${process.env.LMS_HOST || 'localhost'}:${process.env.LMS_PORT || '1234'}/v1/chat/completions`;

        // Prepare messages for API
        const formattedMessages = sessionHistories[socketId]
            .filter(msg => msg && msg.role && msg.content)
            .map(msg => ({ role: msg.role, content: msg.content }));

        console.log(`Making API call to LM Studio: ${apiUrl}`);
        console.log(`Messages count: ${formattedMessages.length}`);

        // Call LM Studio API
        const response = await axios.post(apiUrl, {
            model: currentModelId || 'l3-sthenomaidblackroot-8b-v1', // Use loaded model or fallback
            messages: formattedMessages,
            max_tokens: 4096,
            temperature: 0.87,
            top_p: 0.91,
            frequency_penalty: 0,
            presence_penalty: 0,
            stream: false
        });

        const finalContent = response.data.choices[0].message.content;

        // Add assistant response to session history
        sessionHistories[socketId].push({
            role: 'assistant',
            content: finalContent
        });

        // Update session history with all context (matching template pattern)
        if (sessionHistories[socketId]) {
            sessionHistories[socketId].push(
                { role: 'system', content: collarText },
                { role: 'user', content: userPrompt },
                { role: 'assistant', content: finalContent }
            );
        }

        // Send original response to client (frontend will handle highlighting)
        const wordCount = countWords(finalContent);
        sendResponse(finalContent, socketId, username, wordCount);

    } catch (error) {
        console.error(`Error in handleMessage: ${error.message}`);

        if (error.code === 'ECONNREFUSED') {
            console.error('LM Studio connection failed - is LM Studio running?');
            sendResponse("Sorry, I'm having trouble connecting to the AI. Please make sure LM Studio is running.", socketId, username);
        } else if (error.response && error.response.status === 404) {
            console.error('LM Studio model not found or not loaded');
            sendResponse("Sorry, no AI model is currently loaded. Please load a model in LM Studio.", socketId, username);
        } else {
            sendResponse("Sorry, I encountered an error. Please try again.", socketId, username);
        }
    }
}

// Send response back to main thread
function sendResponse(response, socketId, username, wordCount = 0) {
    if (parentPort) {
        parentPort.postMessage({
            type: 'response',
            response,
            socketId,
            username,
            wordCount
        });
    }
}

// Helper function to count words
function countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

// Garbage collection for session management
function collectGarbage() {
    const now = Date.now();
    const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes
    let removed = 0;

    Object.keys(sessionHistories).forEach(socketId => {
        const session = sessionHistories[socketId];
        if (session.metadata && (now - session.metadata.lastActivity) > SESSION_TIMEOUT) {
            delete sessionHistories[socketId];
            removed++;
        }
    });

    if (removed > 0) {
        console.log(`Garbage collected ${removed} idle sessions`);
    }
}

// Run garbage collection every 5 minutes
setInterval(collectGarbage, 5 * 60 * 1000);

// Initialize the model system on startup
initializeModelSystem();

console.log('LM Studio worker started and ready');

module.exports = { checkRole };
