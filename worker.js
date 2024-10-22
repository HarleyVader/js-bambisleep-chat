const { parentPort } = require("worker_threads");
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');

const bambisleepChalk = {
  primary: chalk.rgb(17, 39, 39),
  primaryAlt: chalk.rgb(33, 105, 105),
  secondary: chalk.rgb(31, 1, 23),
  tertiary: chalk.rgb(242, 242, 242),
  button: chalk.rgb(212, 4, 108),
  buttonAlt: chalk.rgb(17, 0, 0),
  error: chalk.rgb(212, 4, 108).bold,
  success: chalk.rgb(33, 105, 105).bold,
  info: chalk.rgb(1, 124, 138).bold,
  warning: chalk.rgb(17, 39, 39).bold
};

let sessionHistories = {}; // Initialize sessionHistories as an empty object
let triggers;
let collarText;
let finalContent;

async function checkTriggers(triggers) {
  if (!triggers) {
    return triggers;
  } else {
    return triggers;
  }
}

if (!collarText) {
  fs.readFile(path.join(__dirname, 'role.json'), 'utf8', (err, data) => {
    if (err) {
      console.error(bambisleepChalk.error('Error reading role.json:'), err);
      return;
    }
    const roleData = JSON.parse(data);
    collarText = roleData.role;
  });
}

async function getSessionHistories(collarText, userPrompt, socketId) {
  if (!sessionHistories) {
    sessionHistories = {};
  }

  if (!sessionHistories[socketId]) {
    sessionHistories[socketId] = [];
  }

  if (sessionHistories[socketId].length === 0) {
    sessionHistories[socketId].push(
      { role: "system", content: collarText },
      { role: "user", content: userPrompt }
    );
  }

  return sessionHistories[socketId];
}

async function saveSessionHistories(finalContent, socketId) {
  if (!sessionHistories) {
    sessionHistories = {};
  }

  if (!sessionHistories[socketId]) {
    sessionHistories[socketId] = [];
  }

  if (sessionHistories[socketId].length !== 0) {
    sessionHistories[socketId].push(
      { role: "assistant", content: finalContent }
    );
  }

  return sessionHistories[socketId];
}

async function getLoadedModels() {
  const response = await axios.get('http://192.168.0.178:1234/v1/models');
  console.info(bambisleepChalk.info('Model loading response:'), response.data);
  const modelIds = response.data.data.map(model => model.id); // Corrected the path to access models
  const firstModelId = modelIds.length > 0 ? modelIds[0] : null; // Assign the first model ID to a variable
  console.info(bambisleepChalk.info('First model ID:'), firstModelId);
  return firstModelId;
}

async function getMessages(socketId) {
  if (!sessionHistories || !sessionHistories[socketId]) {
    return [];
  }
  return sessionHistories[socketId];
}

async function handleMessage(userPrompt, socketId) {
  let collar = await checkTriggers(triggers);
  collarText += collar;

  if (!userPrompt) {
    console.error(bambisleepChalk.error('No user prompt provided'));
    return;
  }

  if (!finalContent) {
    finalContent = '';
  } 
  
  sessionHistories[socketId] = await getSessionHistories(collarText, userPrompt, socketId);
  
  const modelId = await getLoadedModels(); // Await the model loading and get the first model ID
  if (!modelId) {
    console.error(bambisleepChalk.error('Model loading failed'));
    return;
  }

  const messages = await getMessages(socketId); // Await the messages
  if (messages.length === 0) {
    console.error(bambisleepChalk.error('No messages found for socketId:', socketId));
    return;
  }

  const requestData = {
    model: modelId, // Use the first model ID
    messages: messages,
    temperature: 0.7,
    max_tokens: 256,
    stream: true,
  };

  try {
    const response = await axios.post('http://192.168.0.178:1234/v1/chat/completions', requestData, {
      responseType: 'stream',
    });

    let responseData = '';

    response.data.on('data', (chunk) => {
      responseData += chunk.toString();

      const lines = responseData.split('\n');
      responseData = lines.pop();

      for (const line of lines) {
        if (line.trim() === 'data: [DONE]') {
          continue;
        }

        if (line.startsWith('data: ')) {
          const json = line.substring(6);
          const parsed = JSON.parse(json);
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
            finalContent += parsed.choices[0].delta.content;
            handleResponse(parsed.choices[0].delta.content, socketId);
          }
        }
      }
    });

    response.data.on('end', async () => {
      parentPort.postMessage({ 'response': finalContent });
      session = await saveSessionHistories(finalContent, socketId);
      await saveSessionHistories(socketId);
      try {
        await saveSessionHistoryToFile(socketId);
      } catch (err) {
        console.error(bambisleepChalk.error('Error saving session history:'), err);
      } finally {
        console.info(bambisleepChalk.success(`Session history written to file: ${socketId}`));
      }
    });

    response.data.on('error', (err) => {
      console.error(bambisleepChalk.error('Error in response:'), err);
    });
  } catch (error) {
    if (error.response) {
      console.error(bambisleepChalk.error('Error response data:'), error.response.data);
    } else {
      console.error(bambisleepChalk.error('Error in request:'), error.message);
    }
  }
}

parentPort.on("message", async (msg) => {
  if (msg.type === "triggers") {
    triggers = msg.triggers;
  } else if (msg.type === "message") {
    await handleMessage(msg.data, msg.socketId);
  } else if (msg.type === "save") {
    await saveSessionHistories(msg.socketId);
  } else if (msg.type === "terminate") {
    parentPort.postMessage({ type: "terminate", socketId: msg.socketId });
    process.exit(0);
  }
});

async function handleResponse(response, socketId) {
  parentPort.postMessage({
    type: "response",
    data: response,
    socketId: socketId
  });
}
/*
async function sendSessionHistories(socketId) {
  if (sessionHistories && sessionHistories[socketId]) {
    parentPort.postMessage({
      type: "messageHistory",
      data: sessionHistories[socketId],
      socketId: socketId,
    });
    console.log(bambisleepChalk.info(`Session histories sent to client: ${socketId}`));
  }
}
*/
async function saveSessionHistoryToFile(socketId) {
  if (sessionHistories && sessionHistories[socketId]) {
    const historyFolder = path.join(__dirname, 'history');
    const filePath = path.join(historyFolder, `${socketId}.json`);

    try {
      // Ensure the history folder exists
      if (!fs.existsSync(historyFolder)) {
        fs.mkdirSync(historyFolder);
      }

      // Write the session history to a file
      fs.writeFile(filePath, JSON.stringify(sessionHistories[socketId], null, 2), (err) => {
        if (err) {
          if (err.code === 'EACCES') {
            console.error(bambisleepChalk.error('Permission denied. Unable to save session history:'), err);
          } else {
            console.error(bambisleepChalk.error('Error saving session history:'), err);
          }
        } else {
          console.log(bambisleepChalk.success(`Session history saved for socketId: ${socketId}`));
        }
      });
    } catch (err) {
      console.error(bambisleepChalk.error('Unexpected error occurred while saving session history:'), err);
    }
  } else {
    console.log(bambisleepChalk.warn(`No session history found for socketId: ${socketId}`));
  }
}