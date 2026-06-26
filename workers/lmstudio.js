// workers/lmstudio.js - LM Studio Worker for BambiSleep Chat
const { parentPort } = require('worker_threads');
const axios = require('axios');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ENV = require('../config/env');

// LM Studio Configuration Class with Graceful Degradation
class LMStudioConfig {
    constructor() {
        this.isConfigured = false;
        this.errors = [];
        this.warnings = [];

        try {
            this.loadConfiguration();
        } catch (error) {
            console.warn('⚠️ LM Studio configuration incomplete:', error.message);
            this.errors.push(error.message);
        }
    }

    loadConfiguration() {
        // Use centralized ENV configuration
        if (!ENV.LMS.isConfigured) {
            throw new Error(`LM Studio not configured for ${ENV.NODE_ENV} environment`);
        }

        // Set configuration from centralized ENV
        this.LMS_HOST = ENV.LMS.HOST;
        this.LMS_PORT = ENV.LMS.PORT;
        this.TARGET_MODEL_NAME = ENV.LMS.TARGET_MODEL_NAME;
        this.MAX_SEARCH_ATTEMPTS = ENV.LMS.MAX_SEARCH_ATTEMPTS;
        this.LMS_MODEL_LOAD_TIMEOUT = ENV.LMS.MODEL_LOAD_TIMEOUT;
        this.LMS_API_CALL_TIMEOUT = ENV.LMS.API_CALL_TIMEOUT;
        this.LMS_REST_API_TIMEOUT = ENV.LMS.REST_API_TIMEOUT;
        this.SESSION_TIMEOUT = ENV.LMS.SESSION_TIMEOUT_MINUTES * 60 * 1000;
        this.MAX_CONTEXT_TOKENS = ENV.LMS.MAX_CONTEXT_TOKENS;
        this.MAX_COMPLETION_TOKENS = ENV.LMS.MAX_COMPLETION_TOKENS;

        this.isConfigured = true;
        console.log('✅ LM Studio configured for', ENV.NODE_ENV, 'environment');
    }

    getStatus() {
        return {
            configured: this.isConfigured,
            errors: this.errors,
            warnings: this.warnings,
            host: this.isConfigured ? this.LMS_HOST : 'not-configured',
            port: this.isConfigured ? this.LMS_PORT : 'not-configured'
        };
    }
}

// Prompt template manager — loads JSON files from workers/prompts/
class PromptManager {
    constructor(promptsDir) {
        this.promptsDir = promptsDir;
        this.prompts = {};
        this.defaultPromptId = null;
    }

    load() {
        this.prompts = {};
        this.defaultPromptId = null;
        try {
            if (!fs.existsSync(this.promptsDir)) {
                console.warn(`⚠️ Prompts directory not found: ${this.promptsDir}`);
                return;
            }
            const files = fs.readdirSync(this.promptsDir).filter(f => f.endsWith('.json'));
            for (const file of files) {
                try {
                    const content = JSON.parse(fs.readFileSync(path.join(this.promptsDir, file), 'utf8'));
                    if (content.id) {
                        this.prompts[content.id] = content;
                        if (!this.defaultPromptId) this.defaultPromptId = content.id;
                        console.log(`📝 Loaded prompt: ${content.id} (${content.name})`);
                    }
                } catch (err) {
                    console.warn(`⚠️ Failed to load prompt file ${file}:`, err.message);
                }
            }
            if (this.prompts['bambisleep-classic']) this.defaultPromptId = 'bambisleep-classic';
            console.log(`✅ ${Object.keys(this.prompts).length} prompt(s) loaded. Default: ${this.defaultPromptId}`);
        } catch (error) {
            console.error('❌ Failed to load prompts:', error.message);
        }
    }

    list() {
        return Object.values(this.prompts).map(p => ({ id: p.id, name: p.name, description: p.description }));
    }

    get(id) {
        return this.prompts[id] || null;
    }

    build(id, vars) {
        const prompt = this.get(id);
        if (!prompt) return null;
        let result = this._sub(prompt.main || '', vars);
        if (vars.collar && prompt.collar_addon) result += this._sub(prompt.collar_addon, vars);
        if (prompt.strategy) result += this._sub(prompt.strategy, vars);
        return result;
    }

    _sub(template, vars) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
            vars[key] !== undefined ? vars[key] : match
        );
    }

    hasPrompts() {
        return Object.keys(this.prompts).length > 0;
    }
}

// Initialize configuration
const config = new LMStudioConfig();

// Initialize prompt manager
const promptManager = new PromptManager(path.join(__dirname, 'prompts'));
promptManager.load();

// Set legacy variables for backward compatibility if configured
let LMS_HOST, LMS_PORT, TARGET_MODEL_NAME, MAX_SEARCH_ATTEMPTS;
let LMS_MODEL_LOAD_TIMEOUT, LMS_API_CALL_TIMEOUT, LMS_REST_API_TIMEOUT, SESSION_TIMEOUT;
let MAX_CONTEXT_TOKENS, MAX_COMPLETION_TOKENS;

if (config.isConfigured) {
    LMS_HOST = config.LMS_HOST;
    LMS_PORT = config.LMS_PORT;
    TARGET_MODEL_NAME = config.TARGET_MODEL_NAME;
    MAX_SEARCH_ATTEMPTS = config.MAX_SEARCH_ATTEMPTS;
    LMS_MODEL_LOAD_TIMEOUT = config.LMS_MODEL_LOAD_TIMEOUT;
    LMS_API_CALL_TIMEOUT = config.LMS_API_CALL_TIMEOUT;
    LMS_REST_API_TIMEOUT = config.LMS_REST_API_TIMEOUT;
    SESSION_TIMEOUT = config.SESSION_TIMEOUT;
    MAX_CONTEXT_TOKENS = config.MAX_CONTEXT_TOKENS;
    MAX_COMPLETION_TOKENS = config.MAX_COMPLETION_TOKENS;
}

let currentModelId = null;
let modelSearchAttempts = 0;

// Log configuration status
if (config.isConfigured) {
    console.log(`🔧 LM Studio config: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
    console.log(`🔧 LM Studio endpoint: http://${LMS_HOST}:${LMS_PORT}`);
    console.log(`🎯 Target model: ${TARGET_MODEL_NAME}`);
    console.log(`⏱️  Timeouts - API: ${LMS_API_CALL_TIMEOUT}ms, Model Load: ${LMS_MODEL_LOAD_TIMEOUT}ms, REST API: ${LMS_REST_API_TIMEOUT}ms`);
    console.log(`💾 Context Limits - Max Context: ${MAX_CONTEXT_TOKENS}, Max Completion: ${MAX_COMPLETION_TOKENS}`);
    console.log(`🔍 Max search attempts: ${MAX_SEARCH_ATTEMPTS}`);
    console.log(`⏲️  Session timeout: ${SESSION_TIMEOUT / 60000} minutes`);
} else {
    console.warn('⚠️ LM Studio configuration incomplete - AI features disabled');
    console.warn('🔧 Configuration errors:', config.errors.join(', '));
}

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
            // Check configuration before handling AI-related messages
            if (['chat', 'auto_load_model'].includes(msg.type) && !config.isConfigured) {
                parentPort.postMessage({
                    type: 'error',
                    error: 'LM Studio not configured - check environment variables',
                    configStatus: config.getStatus(),
                    socketId: msg.socketId
                });
                return;
            }

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
                        healthy: config.isConfigured,
                        sessionCount: Object.keys(sessionHistories).length,
                        configStatus: config.getStatus()
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

// Helper: Determine default triggers when the user has none selected
function getDefaultTriggers() {
    // Prefer official triggers from the server (primary + mental categories)
    const primaryTriggers = [];
    const mentalTriggers = [];

    Object.values(triggerData).forEach((trigger) => {
        if (!trigger || !trigger.category || !trigger.name) return;

        const name = trigger.name.toUpperCase();
        const category = trigger.category.toLowerCase();

        if (category === 'primary') {
            primaryTriggers.push(name);
        } else if (category === 'mental') {
            mentalTriggers.push(name);
        }
    });

    const defaults = [];
    defaults.push(...primaryTriggers.slice(0, 2));
    if (mentalTriggers.length > 0) {
        defaults.push(mentalTriggers[0]);
    }

    if (defaults.length === 0) {
        // Fallback hard-coded set if trigger data isn't available
        return ['GOOD GIRL', 'BAMBI', 'SLEEP', 'OBEY', 'RELAX'];
    }

    return defaults;
}

// Core function: Generate system prompt using user-selected triggers
async function checkRole(collar, username, userSelectedTriggers, promptId = null) {
    // Use ONLY the triggers passed from frontend (user's selection)
    const triggerArray = Array.isArray(userSelectedTriggers) ? userSelectedTriggers : [];

    // Determine effective triggers (use defaults if none provided)
    const effectiveTriggers =
        triggerArray.length > 0 ? triggerArray : getDefaultTriggers();

    console.log(
        `🎯 Generating prompt for ${username} with triggers:`,
        effectiveTriggers,
    );
    console.log(`✅ Total selected triggers: ${effectiveTriggers.length}`);

    // Match triggers to official data
    const selectedTriggers = effectiveTriggers
        .map((name) => {
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

    // If we still have no triggers, bail out with a fallback prompt
    if (selectedTriggers.length === 0) {
        console.warn(`⚠️ No triggers available for ${username}`);
        return `You are BambiSleep. Please select a trigger set to begin.`;
    }

    const triggerDescriptionPairs = selectedTriggers.join(' ');
    const selectedTriggerNames = triggerArray.map(t => t.toUpperCase()).join(', ');

    // Try template-based prompt first
    if (promptManager.hasPrompts()) {
        const effectiveId = promptId || promptManager.defaultPromptId;
        const vars = {
            username,
            selectedTriggerNames,
            triggerDescriptionPairs,
            collarName: collarText || 'COLLAR',
            collar
        };
        const built = promptManager.build(effectiveId, vars);
        if (built) {
            console.log(`📝 Using prompt template: ${effectiveId}`);
            return built;
        }
    }

    // No prompt templates available — ask user to add prompt files
    console.error('❌ No prompt templates loaded. Add JSON files to workers/prompts/ and restart or use /prompt reload.');
    return `You are BambiSleep. No prompt templates are loaded. Please add JSON files to workers/prompts/ and use /prompt reload.`;
}

// Handle /prompt chat commands
async function handlePromptCommand(command, socketId, username, currentTriggers = []) {
    const parts = command.trim().split(/\s+/);
    const subcommand = parts[1]?.toLowerCase();

    switch (subcommand) {
        case 'list': {
            const prompts = promptManager.list();
            if (prompts.length === 0) {
                sendResponse('No prompt files loaded. Add JSON files to workers/prompts/ and use /prompt reload.', socketId, username);
                return;
            }
            const currentId = sessionHistories[socketId]?.metadata?.promptId || promptManager.defaultPromptId;
            const lines = prompts.map(p =>
                `${p.id === currentId ? '\u25b6 ' : '  '}${p.id} \u2014 ${p.name}: ${p.description}`
            );
            sendResponse(`Available prompts:\n${lines.join('\n')}\n\nUse /prompt use <id> to switch.`, socketId, username);
            break;
        }
        case 'use': {
            const promptId = parts[2];
            if (!promptId) {
                sendResponse('Usage: /prompt use <id>. Use /prompt list to see available prompts.', socketId, username);
                return;
            }
            if (!promptManager.get(promptId)) {
                sendResponse(`Prompt "${promptId}" not found. Use /prompt list to see available prompts.`, socketId, username);
                return;
            }
            const triggers = sessionHistories[socketId]?.metadata?.lastTriggers || currentTriggers;
            const user = sessionHistories[socketId]?.metadata?.username || username;
            const createdAt = sessionHistories[socketId]?.metadata?.createdAt || Date.now();
            const systemPrompt = await checkRole(collar, user, triggers, promptId);
            const newSession = [];
            newSession.metadata = { createdAt, lastActivity: Date.now(), username: user, promptId, lastTriggers: triggers };
            newSession.push({ role: 'system', content: systemPrompt });
            sessionHistories[socketId] = newSession;
            const promptInfo = promptManager.get(promptId);
            sendResponse(`Switched to: ${promptInfo.name}\n${promptInfo.description}\n\nSession reset with new system prompt.`, socketId, username);
            break;
        }
        case 'info': {
            const currentId = sessionHistories[socketId]?.metadata?.promptId || promptManager.defaultPromptId;
            const current = promptManager.get(currentId);
            if (current) {
                sendResponse(`Current prompt: ${current.name} (${current.id})\n${current.description}`, socketId, username);
            } else {
                sendResponse('No prompt template loaded. Using built-in default.', socketId, username);
            }
            break;
        }
        case 'reload': {
            promptManager.load();
            const count = promptManager.list().length;
            sendResponse(`Reloaded prompts from disk. ${count} prompt(s) available.`, socketId, username);
            break;
        }
        default:
            sendResponse(
                'Prompt commands:\n' +
                '  /prompt list \u2014 show available prompts\n' +
                '  /prompt use <id> \u2014 switch prompt (resets session)\n' +
                '  /prompt info \u2014 show current prompt\n' +
                '  /prompt reload \u2014 reload prompt files from disk',
                socketId, username
            );
    }
}

// Handle chat messages
async function handleMessage(userPrompt, socketId, username, userSelectedTriggers = []) {
    try {
        // Handle special /prompt commands
        if (userPrompt && userPrompt.trim().startsWith('/prompt')) {
            await handlePromptCommand(userPrompt.trim(), socketId, username, userSelectedTriggers);
            return;
        }

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
            const initPromptId = promptManager.defaultPromptId;
            sessionHistories[socketId].metadata = {
                createdAt: Date.now(),
                lastActivity: Date.now(),
                username,
                promptId: initPromptId,
                lastTriggers: userSelectedTriggers
            };

            // Generate system prompt with user-selected triggers
            const systemPrompt = await checkRole(collar, username, userSelectedTriggers, initPromptId);
            sessionHistories[socketId].push({
                role: 'system',
                content: systemPrompt || collarText
            });
        }

        // Update session activity
        sessionHistories[socketId].metadata.lastActivity = Date.now();
        sessionHistories[socketId].metadata.username = username;
        sessionHistories[socketId].metadata.lastTriggers = userSelectedTriggers;

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

        const finalContent = extractCompletionContent(response.data);

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
        } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            console.error('LM Studio request timed out');
            sendResponse("Sorry, the AI took too long to respond. Please try again.", socketId, username);
        } else if (error.response && error.response.status === 404) {
            console.error('LM Studio model not found or not loaded');
            sendResponse("Sorry, no AI model is currently loaded. Please load a model in LM Studio.", socketId, username);
        } else if (error.response && error.response.status >= 500) {
            console.error('LM Studio upstream service error');
            sendResponse("Sorry, the AI service returned an internal error. Please try again.", socketId, username);
        } else {
            console.error('Generic error caught, details:', error.message);
            sendResponse("Sorry, I encountered an error. Please try again.", socketId, username);
        }
    }
}

function extractCompletionContent(responseData) {
    const firstChoice = responseData?.choices?.[0];

    if (!firstChoice) {
        throw new Error('LM Studio response missing choices[0]');
    }

    const messageContent = firstChoice.message?.content;
    if (typeof messageContent === 'string' && messageContent.trim().length > 0) {
        return messageContent;
    }

    if (Array.isArray(messageContent)) {
        const textParts = messageContent
            .map((part) => {
                if (typeof part === 'string') {
                    return part;
                }

                if (part && typeof part.text === 'string') {
                    return part.text;
                }

                return '';
            })
            .filter(Boolean)
            .join('')
            .trim();

        if (textParts.length > 0) {
            return textParts;
        }
    }

    if (typeof firstChoice.text === 'string' && firstChoice.text.trim().length > 0) {
        return firstChoice.text;
    }

    throw new Error('LM Studio response missing assistant content');
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
