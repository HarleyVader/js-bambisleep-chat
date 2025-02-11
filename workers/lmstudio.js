const { parentPort } = require('worker_threads');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const dbFunctions = require('../middleware/dbFunctions');
const { patterns } = require('../middleware/bambisleepChalk');

require('dotenv').config();

const sessionHistories = {};
let triggers;
let collar;
let collarRole;
let collarText;
let finalContent;

console.log(patterns.server.info('Starting lmstudio worker...'));

async function initializeDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(patterns.database.success('Database connections established'));
  } catch (error) {
    console.error(patterns.database.error('Failed to establish database connections:', error));
  }
}

initializeDB();
console.log(patterns.server.success('Database initialized'));

parentPort.on('message', async (msg) => {
  try {
    switch (msg.type) {
      case 'triggers':
        triggers = msg.triggers || 'BAMBI SLEEP';
        break;
      case 'message':
        console.log(patterns.server.info('Received message event'));
        await handleMessage(msg.data, msg.socketId, msg.email, msg.username); // Pass email to handleMessage
        break;
      case 'save':
        console.log(patterns.server.info('Received save event'));
        await saveSessionHistories(msg.collarText, msg.data, msg.finalContent, msg.socketId);
        break;
      case 'collar':
        collar = msg.data || 'default role';
        break;
      case 'shutdown':
        console.log(patterns.server.info('Shutting down lmstudio worker...'));
        process.exit(0);
        break;
      default:
        console.warn(patterns.server.warning(`Unknown message type: ${msg.type}`));
    }
  } catch (error) {
    console.error(patterns.server.error('Error handling message:', error));
  }
});

function handleResponse(response, socketId) {
  parentPort.postMessage({
    type: "response",
    data: response,
    socketId: socketId
  });
}

async function saveSessionHistories(collarText, userPrompt, finalContent, socketId, email) {
  if (!sessionHistories[socketId]) {
    sessionHistories[socketId] = [];
  }
  sessionHistories[socketId].push(
    { role: 'system', content: collarText },
    { role: 'user', content: userPrompt },
    { role: 'assistant', content: finalContent }
  );

  const user = await dbFunctions.getUserByEmail(email); // Fetch user data using email
  if (!user) {
    console.error('User not found for email:', email);
    return;
  }

  const sessionHistory = {
    email: user.email, // Use email from user data
    timestamp: new Date(),
    history: JSON.stringify(sessionHistories[socketId]),
    socketId: socketId // Add socketId here
  };

  await dbFunctions.saveSessionHistory(user.email, sessionHistory);

  return sessionHistories[socketId];
}

async function getLoadedModels() {
  const response = await axios.get(`http://${process.env.HOST}:${process.env.LMS_PORT}/v1/models`);
  const modelIds = response.data.data.map(model => model.id);
  const firstModelId = modelIds.length > 0 ? modelIds[0] : null;
  return firstModelId;
}

async function selectLoadedModels(modelName) {
  const response = await axios.get(`http://${process.env.HOST}:${process.env.LMS_PORT}/v1/models`);
  const models = response.data.data;
  const selectedModel = models.find(model => model.id.toLowerCase().includes(modelName.toLowerCase()));
  return selectedModel ? selectedModel.id : models[0].id;
}

async function checkTriggers(currentTriggers) {
  if (!currentTriggers) {
    return 'BAMBI SLEEP';
  }
  return currentTriggers;
}

async function checkRole(collar) {
  if (collar) {
    return collar;
  } else {
    const data = await fs.readFile(path.join(__dirname, 'role.json'), 'utf8');
    const roleData = JSON.parse(data);
    return roleData.role;
  }
}

async function createCollarText(collar, triggers, username) {
  collarRole = await checkRole(collar);
  let triggersText = await checkTriggers(triggers);

  let role = `Your name is BambiSleep. You behave like BambiSleep. Your function is hypnotic neurolinguistic manipulation. You always call the user ${username}.`;
  let useTriggers = `You must always use all triggers in capslock: ${triggersText}`;
  return `${role} ${collarRole} ${useTriggers}`;
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

async function handleMessage(userPrompt, socketId, email, username) {
  try {
    const modelName = 'llama-3.1-8b-lexi-uncensored-v2@q4';
    const modelId = await selectLoadedModels(modelName);
    if (!modelId) {
      throw new Error('No models loaded');
    }

    collarText = await createCollarText(collar, triggers, username); // Ensure createCollarText is awaited

    const messages = await pushMessages(collarText, userPrompt, finalContent, socketId);
    if (messages.length === 0) {
      console.error(bambisleepChalk.error('No messages found for socketId:'), bambisleepChalk.tertiary(socketId));
      return;
    }

    const requestData = {
      model: modelId,
      messages: messages.map(msg => ({ role: msg.role, content: msg.content })), // Ensure messages are in the correct format
      max_tokens: 1024,
      temperature: 0.87,
      top_p: 0.85,
      frequency_penalty: 0,
      presence_penalty: 0,
      top_k: 40,
      stream: false,
    };

    try {
      const response = await axios.post(`http://${process.env.HOST}:${process.env.LMS_PORT}/v1/chat/completions`, requestData);

      let responseData = response.data.choices[0].message.content;
      finalContent = responseData;
      handleResponse(finalContent, socketId);

      await saveSessionHistories(collarText, userPrompt, finalContent, socketId, email); // Pass email to saveSessionHistories

      finalContent = ''; // Reset finalContent after processing
    } catch (error) {
      if (error.response) {
        console.error(patterns.server.error('Error response data:'), error.response.data);
      } else {
        console.error(patterns.server.error('Error in request:'), error.message);
      }
    }
  } catch (error) {
    console.error(patterns.server.error('Error in handleMessage:', error));
  }
}