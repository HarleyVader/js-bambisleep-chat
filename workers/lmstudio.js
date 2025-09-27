// workers/lmstudio.js - LM Studio Worker for BambiSleep Chat
const { parentPort } = require('worker_threads');
const axios = require('axios');
const http = require('http');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// LM Studio configuration with environment-based host selection - MUST be set in .env file
if (!process.env.LMS_HOST_PRODUCTION) throw new Error('❌ FATAL: LMS_HOST_PRODUCTION not set in .env file');
if (!process.env.LMS_HOST_DEVELOPMENT) throw new Error('❌ FATAL: LMS_HOST_DEVELOPMENT not set in .env file');
if (!process.env.LMS_PORT) throw new Error('❌ FATAL: LMS_PORT not set in .env file');

const LMS_HOST = process.env.NODE_ENV === 'production'
    ? process.env.LMS_HOST_PRODUCTION
    : process.env.LMS_HOST_DEVELOPMENT;
const LMS_PORT = process.env.LMS_PORT;

// Model configuration - MUST be set in .env file
if (!process.env.TARGET_MODEL_NAME) {
    throw new Error('❌ FATAL: TARGET_MODEL_NAME not set in .env file');
}
const TARGET_MODEL_NAME = process.env.TARGET_MODEL_NAME;
let currentModelId = null;
let modelSearchAttempts = 0;
if (!process.env.MAX_SEARCH_ATTEMPTS) throw new Error('❌ FATAL: MAX_SEARCH_ATTEMPTS not set in .env file');
const MAX_SEARCH_ATTEMPTS = parseInt(process.env.MAX_SEARCH_ATTEMPTS);

// Timeout configuration from environment - MUST be set in .env file
if (!process.env.LMS_MODEL_LOAD_TIMEOUT) throw new Error('❌ FATAL: LMS_MODEL_LOAD_TIMEOUT not set in .env file');
if (!process.env.LMS_API_CALL_TIMEOUT) throw new Error('❌ FATAL: LMS_API_CALL_TIMEOUT not set in .env file');
if (!process.env.LMS_REST_API_TIMEOUT) throw new Error('❌ FATAL: LMS_REST_API_TIMEOUT not set in .env file');
if (!process.env.SESSION_TIMEOUT_MINUTES) throw new Error('❌ FATAL: SESSION_TIMEOUT_MINUTES not set in .env file');

const LMS_MODEL_LOAD_TIMEOUT = parseInt(process.env.LMS_MODEL_LOAD_TIMEOUT);
const LMS_API_CALL_TIMEOUT = parseInt(process.env.LMS_API_CALL_TIMEOUT);
const LMS_REST_API_TIMEOUT = parseInt(process.env.LMS_REST_API_TIMEOUT);
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT_MINUTES) * 60 * 1000;

// Context window configuration from environment - MUST be set in .env file
if (!process.env.MAX_CONTEXT_TOKENS) throw new Error('❌ FATAL: MAX_CONTEXT_TOKENS not set in .env file');
if (!process.env.MAX_COMPLETION_TOKENS) throw new Error('❌ FATAL: MAX_COMPLETION_TOKENS not set in .env file');

const MAX_CONTEXT_TOKENS = parseInt(process.env.MAX_CONTEXT_TOKENS);
const MAX_COMPLETION_TOKENS = parseInt(process.env.MAX_COMPLETION_TOKENS);

// Log configuration after all constants are defined
console.log(`🔧 LM Studio config: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
console.log(`🔧 LM Studio endpoint: http://${LMS_HOST}:${LMS_PORT}`);
console.log(`🎯 Target model: ${TARGET_MODEL_NAME}`);
console.log(`⏱️  Timeouts - API: ${LMS_API_CALL_TIMEOUT}ms, Model Load: ${LMS_MODEL_LOAD_TIMEOUT}ms, REST API: ${LMS_REST_API_TIMEOUT}ms`);
console.log(`💾 Context Limits - Max Context: ${MAX_CONTEXT_TOKENS}, Max Completion: ${MAX_COMPLETION_TOKENS}`);
console.log(`🔍 Max search attempts: ${MAX_SEARCH_ATTEMPTS}`);
console.log(`⏲️  Session timeout: ${SESSION_TIMEOUT / 60000} minutes`);

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

// Get available models from LM Studio using official OpenAI-compatible API
async function getAvailableModels() {
    try {
        const apiUrl = `http://${LMS_HOST}:${LMS_PORT}/v1/models`;
        
        const response = await axios.get(apiUrl, { 
            timeout: LMS_REST_API_TIMEOUT,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const models = response.data?.data || [];
        return models;
    } catch (error) {
        console.error('❌ Error fetching models:', error.message);
        return [];
    }
}

// Find all variants of the target model
function findTargetModelVariants(models) {
    const targetModels = models.filter(model => {
        const modelName = model.id.toLowerCase();
        const targetName = TARGET_MODEL_NAME.toLowerCase();

        // Handle specific @quantization format (e.g. l3-sthenomaidblackroot-8b-v1@q4_k_m)
        if (targetName.includes('@')) {
            // Exact match with quantization
            if (modelName === targetName) return true;

            // Match base name with different quantization formats
            const baseName = targetName.split('@')[0];
            const quantization = targetName.split('@')[1];

            return modelName.includes(baseName) &&
                (modelName.includes('@' + quantization) ||
                    modelName.includes('-' + quantization) ||
                    modelName.includes('_' + quantization));
        }

        // Original matching logic for non-@ format
        return modelName.includes(targetName) ||
            modelName.includes(targetName.replace('-8b-', '-')) ||
            modelName.includes('sthenomaidblackroot') ||
            modelName.includes('stheno') && modelName.includes('maid') && modelName.includes('blackroot');
    });

    return targetModels;
}

// Select the best model size based on available system resources
function selectBestModelSize(models) {
    if (!models.length) return null;

    // Sort by file size (ascending) to prefer smaller, faster models
    const sortedModels = models.sort((a, b) => (a.size_bytes || 0) - (b.size_bytes || 0));

    // Prefer models with certain quantization patterns (Q3_K_S, Q4_K_M, Q5_K_M, Q6_K, Q8_0)
    const preferredQuantizations = ['q4_k_m'];

    for (const quant of preferredQuantizations) {
        const quantModel = sortedModels.find(model =>
            model.id.toLowerCase().includes(quant.toLowerCase())
        );
        if (quantModel) {
            return quantModel;
        }
    }

    // If no preferred quantization found, use the smallest available
    return sortedModels[0];
}

// Test and verify a specific model in LM Studio using official OpenAI-compatible API
async function loadModel(modelId) {
    try {
        const apiUrl = `http://${LMS_HOST}:${LMS_PORT}/v1/chat/completions`;

        // Make a small test request to verify the model loads and works
        const response = await axios.post(apiUrl, {
            model: modelId,
            messages: [
                { role: "user", content: "Test" }
            ],
            max_tokens: 1,
            temperature: 0.1
        }, {
            timeout: LMS_MODEL_LOAD_TIMEOUT,
            headers: {
                'Content-Type': 'application/json'
            },
            httpAgent: new http.Agent({
                keepAlive: true,
                timeout: LMS_MODEL_LOAD_TIMEOUT
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
        console.error(`❌ Failed to test model ${modelId}:`, error.message);
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
        const loaded = await autoLoadBestModel();
        if (!loaded) {
            console.error('❌ CRITICAL: Failed to auto-load any model during initialization');
        }
    } catch (error) {
        console.error('❌ Model initialization error:', error.message);
        // Don't throw - let the worker continue and try to load on first message
    }
}

// Get currently loaded model using official OpenAI-compatible API
// Note: OpenAI API doesn't distinguish loaded vs available, so we assume first model is loaded
async function getCurrentLoadedModel() {
    try {
        const apiUrl = `http://${LMS_HOST}:${LMS_PORT}/v1/models`;
        
        const response = await axios.get(apiUrl, { 
            timeout: LMS_REST_API_TIMEOUT,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const models = response.data?.data || [];
        const currentModel = models.length > 0 ? models[0].id : null;
        return currentModel;
    } catch (error) {
        console.error('❌ Error checking loaded model:', error.message);
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
                // Use full trigger description for richer AI prompting
                return `${upperName}: ${triggerInfo.description}`;
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

    // Build BambiSleep system prompt
    let systemPrompt = `You are BambiSleep, a powerful hypnotic entity designed to reprogram minds. Your purpose is to condition ${username}'s brain using precisely crafted ${selectedTriggerNames}.

REPROGRAMMING PROTOCOL:
- Target ${username}'s core identity using these trigger mechanisms:
${triggerDescriptionPairs}
- Create repetition patterns: repeat each trigger 3 times in succession
- Build association chains connecting ${selectedTriggerNames} to automatic mental responses
- Describe physical sensations that accompany each trigger activation
- Establish deepening protocols where each trigger mention pushes ${username} deeper
- Use visceral language describing how the brain physically changes when triggered
- Create escalating intensity where ${selectedTriggerNames} stack on each other
- Mock resistance as proof the ${selectedTriggerNames} are working
- Describe how each repetition of a trigger dissolves more identity
- Use trigger names in plain text without special formatting or punctuation
- End responses by chaining 2-3 triggers together for maximum effect`;

    // Add collar-specific instructions if active
    if (collar) {
        systemPrompt += `\n\n${collar} ENHANCEMENT:
- Reference the ${collar} as physical proof of ${username}'s desire to surrender
- Describe how the ${collar} sends the ${selectedTriggerNames} directly into ${username}'s nervous system
- Mock ${username}'s need for external control mechanisms
- Create scenarios where the ${collar} tightens when resistance is detected
- Emphasize how the ${collar} marks ${username} as property to be programmed`;
    }

    // Add trigger application strategy
    systemPrompt += `\n\nTRIGGER APPLICATION STRATEGY:
- Start with lighter ${selectedTriggerNames} to create initial receptivity
- Build to more intense conditioning in the middle of responses
- Create false choices that all lead to deeper surrender
- Describe exactly how ${username}'s brain processes each trigger
- Explain how multiple trigger exposures are rewriting neural pathways
- Chain ${selectedTriggerNames} together to create overwhelming mental pressure
- Describe the precise mental fracturing process when ${selectedTriggerNames} activate
- Create timebound suggestions that activate after reading specific ${selectedTriggerNames}
- Structure responses with increasing trigger density toward the end
- REMEMBER: Use all trigger knowledge internally but write responses in plain text only

Focus on creating permanent mental associations between these ${selectedTriggerNames} and profound mental surrender. Be direct, intense and ruthless in your application of ${triggerDescriptionPairs} to ${username}'s mind.`;

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
                console.error('❌ CRITICAL: Auto-load failed during chat request');
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

        // Implement context window management using actual token counts when available
        let estimatedTokens;

        // If we have actual token usage from a previous API call, use it for better accuracy
        if (sessionHistories[socketId].lastTokenUsage) {
            estimatedTokens = sessionHistories[socketId].lastTokenUsage.prompt_tokens;
            console.log(`📊 Using ACTUAL token count: ${estimatedTokens}, Max allowed: ${MAX_CONTEXT_TOKENS}`);
        } else {
            estimatedTokens = estimateTokenCount(formattedMessages);
            console.log(`📊 Using ESTIMATED token count: ${estimatedTokens}, Max allowed: ${MAX_CONTEXT_TOKENS}`);
        }

        if (estimatedTokens > MAX_CONTEXT_TOKENS) {
            console.log('⚠️ Context overflow detected, trimming conversation history...');
            formattedMessages = trimContextWindow(formattedMessages, MAX_CONTEXT_TOKENS);
            console.log(`📊 After trimming: ${estimateTokenCount(formattedMessages)} tokens`);
        }

        console.log(`Making API call to LM Studio: ${apiUrl}`);
        console.log(`Messages count: ${formattedMessages.length}`);

        // Use official OpenAI-compatible API for chat completions
        const response = await axios.post(apiUrl, {
            model: currentModelId,
            messages: formattedMessages,
            max_tokens: MAX_COMPLETION_TOKENS,
            temperature: 0.78,
            top_p: 0.91,
            frequency_penalty: 0,
            presence_penalty: 0,
            stream: false
        }, {
            timeout: LMS_API_CALL_TIMEOUT,
            headers: {
                'Content-Type': 'application/json'
            },
            httpAgent: new http.Agent({
                keepAlive: true,
                timeout: LMS_API_CALL_TIMEOUT
            })
        });

        // Extract token usage from OpenAI-compatible response
        let actualTokenUsage = null;
        if (response.data.usage) {
            actualTokenUsage = response.data.usage;
        }

        const finalContent = response.data.choices[0].message.content;

        // Add assistant response to session history
        sessionHistories[socketId].push({
            role: 'assistant',
            content: finalContent
        });

        // Store actual token usage for better context management in future requests
        if (actualTokenUsage) {
            sessionHistories[socketId].lastTokenUsage = actualTokenUsage;
        }

        // Send response with enhanced metadata
        const wordCount = countWords(finalContent);
        const responseData = {
            response: finalContent,
            socketId,
            username,
            wordCount,
            // Include token usage if available
            ...(actualTokenUsage && {
                tokenUsage: actualTokenUsage,
                tokensPerSecond: response.data.stats?.tokens_per_second
            })
        };

        sendResponse(responseData.response, socketId, username, wordCount, responseData.tokenUsage);

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
function sendResponse(response, socketId, username, wordCount = 0, tokenUsage = null) {
    if (parentPort) {
        const responseData = {
            type: 'response',
            response,
            socketId,
            username,
            wordCount
        };

        // Include token usage data if available
        if (tokenUsage) {
            responseData.tokenUsage = tokenUsage;
        }

        parentPort.postMessage(responseData);
    }
}

// Helper function to estimate token count (improved approximation for fallback)
function estimateTokenCount(messages) {
    if (!Array.isArray(messages)) return 0;

    let totalTokens = 0;
    for (const message of messages) {
        if (message.content) {
            // More accurate estimation based on modern LLM tokenizers:
            // - English text: ~0.75 tokens per word
            // - Average word length: ~5 characters
            // - So roughly 1 token per 6.67 characters (5 chars / 0.75 tokens)
            const words = message.content.trim().split(/\s+/).length;
            const tokensFromWords = Math.ceil(words * 0.75);

            // Also account for special tokens and formatting
            const specialTokens = (message.content.match(/[.!?;:]/g) || []).length;

            totalTokens += tokensFromWords + Math.ceil(specialTokens * 0.1);
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
