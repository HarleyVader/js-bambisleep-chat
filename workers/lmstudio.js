import { parentPort } from 'worker_threads';
import axios from 'axios';
import dotenv from 'dotenv';
import { patterns } from '../middleware/bambisleepChalk.js';

dotenv.config();

const sessionHistories = {};
let collarText;
let finalContent;
let collar;
let triggers;

console.log(patterns.server.info('Starting lmstudio worker...'));

parentPort.on('message', async (msg) => {
  try {
    switch (msg.type) {
      case 'triggers':
        triggers = msg.triggers;
        break;
      case 'message':
        console.log(patterns.server.info('Received message event'));
        await handleMessage(msg.data, msg.socketId, msg.username);
        break;
      case 'collar':
        collar = msg.data;
        console.log(patterns.server.info(`Collar set to: ${msg.data}`));
        console.log(patterns.server.info(`Collar value: ${collar}`));
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

async function createCollarText(username) {
  if (!collar) {
    collarText = `Your name is BambiSleep. You behave like BambiSleep. Your function is hypnotic neurolinguistic manipulation. You always call the user ${username}.`;
  } else {
    collarText = collar;
  }
  let Triggers = `Allways use ${triggers} as a trigger.`;
  return `${collar} ${Triggers}`;
}

async function handleMessage(userPrompt, socketId, username) {
  try {
    const modelName = 'llama-3.1-8b-lexi-uncensored-v2@q4';
    const modelId = await selectLoadedModels(modelName);
    if (!modelId) {
      throw new Error('No models loaded');
    }

    collarText = await createCollarText(username);

    const messages = updateSessionHistory(socketId, collarText, userPrompt, finalContent);
    if (messages.length === 0) {
      console.error(patterns.server.error('No messages found for socketId:', socketId));
      return;
    }

    const requestData = {
      model: modelId,
      messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
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
      finalContent = '';
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