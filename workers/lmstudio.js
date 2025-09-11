// workers/lmstudio.js
// LM Studio Worker for BambiSleep Chat
const { parentPort } = require('worker_threads');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Session management
const sessionHistories = {};
let triggers = [];
let collar = false;
let collarText = '';

// Core trigger descriptions (simplified from template)
const triggerDescriptions = {
    'BAMBI SLEEP': 'Core trigger for deep mindless trance state',
    'GOOD GIRL': 'Reinforcement trigger for obedience and submission',
    'BLANK': 'Empty mind trigger, removes all thoughts',
    'MINDLESS': 'Complete mental surrender trigger',
    'OBEY': 'Command compliance trigger',
    'SUBMIT': 'Surrender and acceptance trigger',
    'BIMBO': 'Personality transformation trigger',
    'DOLL': 'Object transformation trigger',
    'PINK': 'Feminization and aesthetic trigger',
    'SPIRAL': 'Visual hypnotic induction trigger'
};

// Worker message handling
if (parentPort) {
    parentPort.on('message', async (msg) => {
        try {
            switch (msg.type) {
                case 'chat':
                    await handleMessage(msg.prompt, msg.socketId, msg.username);
                    break;

                case 'triggers':
                    triggers = msg.triggers || [];
                    console.log(`Worker received triggers: ${triggers.join(', ')}`);
                    break;

                case 'collar':
                    collar = true;
                    collarText = msg.data;
                    console.log(`Worker collar activated: "${collarText.substring(0, 30)}..."`);
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

// Core function: Check role and generate system prompt
async function checkRole(collar, username, triggers) {
    // Convert triggers array to trigger details
    const triggerArray = Array.isArray(triggers) ? triggers : [];

    // Match triggers to descriptions
    const selectedTriggers = triggerArray
        .map(name => {
            const upperName = name.toUpperCase();
            const description = triggerDescriptions[upperName] || `${upperName} trigger`;
            return `${upperName} - ${description}`;
        })
        .filter(Boolean);

    // Default triggers if none provided
    if (selectedTriggers.length === 0) {
        selectedTriggers.push(
            'BAMBI SLEEP - Core trigger for deep mindless trance state',
            'GOOD GIRL - Reinforcement trigger for obedience and submission',
            'BLANK - Empty mind trigger, removes all thoughts'
        );
    }

    const triggerDescriptionPairs = selectedTriggers.join('\n');

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
async function handleMessage(userPrompt, socketId, username) {
    try {
        // Validate input
        if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
            console.warn(`Invalid prompt from ${username}`);
            sendResponse("Sorry, I couldn't understand your message. Please try again.", socketId, username);
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

            // Generate system prompt
            const systemPrompt = await checkRole(collar, username, triggers);
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
            model: 'local-model', // LM Studio uses loaded model
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

        // Send response
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

console.log('LM Studio worker started and ready');

module.exports = { checkRole };
