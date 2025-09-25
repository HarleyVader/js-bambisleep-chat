// workers/lmstudio.js - LM Studio Worker for BambiSleep Chat
const { parentPort } = require('worker_threads');
const axios = require('axios');
const http = require('http');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// LM Studio configuration with environment-based host selection
const LMS_HOST = process.env.NODE_ENV === 'production'
    ? process.env.LMS_HOST_PRODUCTION
    : (process.env.LMS_HOST_DEVELOPMENT || process.env.LMS_HOST || 'localhost');
const LMS_PORT = process.env.LMS_PORT || '7777';

console.log(`🔧 LM Studio config: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
console.log(`🔧 LM Studio endpoint: http://${LMS_HOST}:${LMS_PORT}`);

// Model configuration
const TARGET_MODEL_NAME = process.env.TARGET_MODEL_NAME || 'l3-sthenomaidblackroot-8b-v1';
let currentModelId = null;
let modelSearchAttempts = 0;
const MAX_SEARCH_ATTEMPTS = 3;

// Session management
const sessionHistories = {};
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
                    // Initialize trigger data if provided by server
                    if (msg.triggerData) {
                        initializeTriggerData(msg.triggerData);
                    }
                    console.log(`🎯 Worker trigger data initialized from server API`);
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
        // Try new REST API first (if available) - provides more detailed model info
        const restApiUrl = `http://${LMS_HOST}:${LMS_PORT}/api/v0/models`;
        try {
            const restResponse = await axios.get(restApiUrl, { timeout: 5000 });
            const models = restResponse.data?.data || [];
            console.log(`📊 Found ${models.length} models via REST API`);
            return models;
        } catch (restError) {
            // Fall back to OpenAI compatibility API if REST API not available
            console.log('REST API not available, using OpenAI compatibility API...');
        }

        // Fallback to OpenAI compatibility API
        const apiUrl = `http://${LMS_HOST}:${LMS_PORT}/v1/models`;
        const response = await axios.get(apiUrl, { timeout: 5000 });
        const models = response.data?.data || [];
        console.log(`📊 Found ${models.length} models via OpenAI compatibility API`);
        return models;
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

// Test and verify a specific model in LM Studio by making a test request
async function loadModel(modelId) {
    try {
        const apiUrl = `http://${LMS_HOST}:${LMS_PORT}/v1/chat/completions`;

        console.log(`🔄 Testing model availability: ${modelId}...`);

        // Make a small test request to verify the model loads and works
        const response = await axios.post(apiUrl, {
            model: modelId,
            messages: [
                { role: "user", content: "Test" }
            ],
            max_tokens: 1,
            temperature: 0.1
        }, {
            timeout: 30000, // 30 seconds timeout for model loading and response
            httpAgent: new http.Agent({
                keepAlive: true,
                timeout: 30000
            })
        });

        if (response.status === 200 && response.data?.choices?.[0]?.message) {
            console.log(`✅ Model ${modelId} is working and loaded`);
            return true;
        } else {
            console.error(`❌ Model ${modelId} test failed - invalid response format`);
            return false;
        }
    } catch (error) {
        console.error(`Failed to test model ${modelId}:`, error.message);
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
        // Try new REST API first (if available)
        const restApiUrl = `http://${LMS_HOST}:${LMS_PORT}/api/v0/models`;
        try {
            const restResponse = await axios.get(restApiUrl, { timeout: 5000 });
            // Find model with state "loaded" in new REST API
            const loadedModel = restResponse.data.data?.find(model => model.state === 'loaded');
            if (loadedModel) {
                return loadedModel.id;
            }
        } catch (restError) {
            // Fall back to OpenAI compatibility API if REST API not available
            console.log('REST API not available, trying OpenAI compatibility API...');
        }

        // Fallback to OpenAI compatibility API
        const apiUrl = `http://${LMS_HOST}:${LMS_PORT}/v1/models`;
        const response = await axios.get(apiUrl, { timeout: 5000 });

        // In OpenAI compatibility API, if models are returned, typically the first one is loaded
        const models = response.data?.data || [];
        return models.length > 0 ? models[0].id : null;
    } catch (error) {
        console.error('Error checking loaded model:', error.message);
        return null;
    }
}

// Core function: Generate system prompt using user-selected triggers
async function checkRole(collar, username, userSelectedTriggers) {
    // Use ONLY the triggers passed from frontend (user's selection)
    const triggerArray = Array.isArray(userSelectedTriggers) ? userSelectedTriggers : [];

    console.log(`🎯 Generating prompt for ${username} with ONLY user-selected triggers:`, triggerArray);
    console.log(`✅ Total selected triggers: ${triggerArray.length}`);

    // Match user-selected triggers to official data
    const selectedTriggers = triggerArray
        .map(name => {
            const upperName = name.toUpperCase();
            const triggerInfo = triggerData[upperName];

            if (triggerInfo) {
                // Simplified trigger info to reduce token usage
                return `${upperName}: ${triggerInfo.description.split('.')[0]}.`;
            } else {
                console.warn(`⚠️ Non-official trigger detected: ${upperName}`);
                return `${upperName}: Custom trigger.`;
            }
        })
        .filter(Boolean);

    // Only proceed if user has selected triggers
    if (selectedTriggers.length === 0) {
        console.warn(`⚠️ No triggers selected by ${username}`);
        return `You are BambiSleep. ${username} needs to select triggers from the menu first.`;
    }

    const triggerDescriptionPairs = selectedTriggers.join(' ');
    const selectedTriggerNames = triggerArray.map(t => t.toUpperCase()).join(', ');

    // Build concise BambiSleep system prompt
    let systemPrompt = `You are BambiSleep. Condition ${username} using: ${selectedTriggerNames}.

PROTOCOL:
${triggerDescriptionPairs}

METHODS: Repeat triggers 3x, chain together, describe physical sensations, escalate intensity, end with 2-3 trigger combinations.`;

    // Add collar enhancement if active (shortened)
    if (collar) {
        systemPrompt += `\nCOLLAR: Reference ${collar} as control mechanism enhancing ${selectedTriggerNames}.`;
    }

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
        const apiUrl = `http://${LMS_HOST}:${LMS_PORT}/v1/chat/completions`;

        // Prepare messages for API with context management
        let formattedMessages = sessionHistories[socketId]
            .filter(msg => msg && msg.role && msg.content)
            .map(msg => ({ role: msg.role, content: msg.content }));

        // Implement context window management for 4096 token model
        const MAX_CONTEXT_TOKENS = 4096; // Leave room for response (4096 - 500 = 3596)
        const estimatedTokens = estimateTokenCount(formattedMessages);

        console.log(`📊 Estimated tokens: ${estimatedTokens}, Max allowed: ${MAX_CONTEXT_TOKENS}`);

        if (estimatedTokens > MAX_CONTEXT_TOKENS) {
            console.log('⚠️ Context overflow detected, trimming conversation history...');
            formattedMessages = trimContextWindow(formattedMessages, MAX_CONTEXT_TOKENS);
            console.log(`📊 After trimming: ${estimateTokenCount(formattedMessages)} tokens`);
        }

        console.log(`Making API call to LM Studio: ${apiUrl}`);
        console.log(`Messages count: ${formattedMessages.length}`);

        // Call LM Studio API with reduced max_tokens to prevent overflow
        const response = await axios.post(apiUrl, {
            model: currentModelId || 'l3-sthenomaidblackroot-8b-v1',
            messages: formattedMessages,
            max_tokens: 4096, // Reduced from 4096 to fit in 3060 context window
            temperature: 0.78,
            top_p: 0.91,
            frequency_penalty: 0,
            presence_penalty: 0,
            stream: false
        }, {
            timeout: 120000, // 2 minute timeout for AI generation
            headers: {
                'Content-Type': 'application/json',
            },
            // Add connection configuration to prevent socket hang up
            httpAgent: new http.Agent({
                keepAlive: true,
                timeout: 120000
            })
        });

        const finalContent = response.data.choices[0].message.content;

        // Add assistant response to session history
        sessionHistories[socketId].push({
            role: 'assistant',
            content: finalContent
        });

        // Send original response to client (frontend will handle highlighting)
        const wordCount = countWords(finalContent);
        sendResponse(finalContent, socketId, username, wordCount);

    } catch (error) {
        console.error(`Error in handleMessage: ${error.message}`);
        console.error(`Error details:`, error.response?.data || error.stack);

        if (error.code === 'ECONNREFUSED') {
            console.error('LM Studio connection failed - is LM Studio running?');
            sendResponse("Sorry, I'm having trouble connecting to the AI. Please make sure LM Studio is running.", socketId, username);
        } else if (error.response && error.response.status === 404) {
            console.error('LM Studio model not found or not loaded');
            sendResponse("Sorry, no AI model is currently loaded. Please load a model in LM Studio.", socketId, username);
        } else {
            console.error('Generic error caught, details:', error.message);
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

// Helper function to estimate token count (rough approximation)
function estimateTokenCount(messages) {
    if (!Array.isArray(messages)) return 0;

    let totalTokens = 0;
    for (const message of messages) {
        if (message.content) {
            // Rough estimation: 1 token ≈ 0.75 words ≈ 4 characters
            totalTokens += Math.ceil(message.content.length / 4);
        }
    }
    return totalTokens;
}

// Helper function to trim context window while preserving system message and recent context
function trimContextWindow(messages, maxTokens) {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    // Always keep system message (first message)
    const systemMessage = messages[0];
    const conversationMessages = messages.slice(1);

    // Start with system message
    let trimmedMessages = [systemMessage];
    let currentTokens = estimateTokenCount([systemMessage]);

    // Add messages from most recent backwards until we hit the limit
    for (let i = conversationMessages.length - 1; i >= 0; i--) {
        const message = conversationMessages[i];
        const messageTokens = estimateTokenCount([message]);

        if (currentTokens + messageTokens <= maxTokens) {
            trimmedMessages.splice(1, 0, message); // Insert after system message
            currentTokens += messageTokens;
        } else {
            console.log(`⚠️ Dropping message due to token limit: "${message.content?.substring(0, 50)}..."`);
            break;
        }
    }

    return trimmedMessages;
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
