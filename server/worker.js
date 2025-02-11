const { parentPort } = require("worker_threads");
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');

const bambisleepChalk = {
  primary: chalk.hex('#112727'),
  primaryAlt: chalk.hex('#00a9a9'),
  secondary: chalk.hex('#40002f'),
  tertiary: chalk.hex('#f2f2f2'),
  button: chalk.hex('#d4046c'),
  buttonAlt: chalk.hex('#110000'),
  error: chalk.hex('#d4046c').bold,
  success: chalk.hex('#00a9a9').bold,
  info: chalk.hex('#017C8A').bold,
  warning: chalk.hex('#112727').bold
};

let sessionHistories = {}; // Initialize sessionHistories as an empty object
let triggers;
let collar;
let collarText;
let finalContent;
let role;

async function getLoadedModels() {
  const response = await axios.get('http://192.168.0.178:1234/v1/models');
  const modelIds = response.data.data.map(model => model.id); // Corrected the path to access models
  const firstModelId = modelIds.length > 0 ? modelIds[0] : null; // Assign the first model ID to a variable
  return firstModelId;
}

async function checkTriggers(triggers) {
  if (!triggers) {
    triggers = 'BAMBI SLEEP';
    return triggers;
  } else {
    return triggers;
  }
}

async function checkRole() {
  try {
    const data = await fs.readFile(path.join(__dirname, 'role.json'), 'utf8');
    const roleData = JSON.parse(data);
    return roleData.role;
  } catch (err) {
    console.error(bambisleepChalk.error('Error reading role.json:'), err);
    return undefined;
  }
}

async function saveSessionHistories(collarText, userPrompt, finalContent, socketId) {
  if (!sessionHistories) {
    sessionHistories = {};
  }
  if (!sessionHistories[socketId]) {
    sessionHistories[socketId] = [];
  }
  if (sessionHistories[socketId].length !== 0) {
    sessionHistories[socketId].push(
      { role: "system", content: collarText },
      { role: "user", content: userPrompt },
      { role: "assistant", content: finalContent }
    );
  }
  return sessionHistories[socketId];
}

async function getMessages(collarText, userPrompt, finalContent, socketId) {
  if (!sessionHistories || !sessionHistories[socketId]) {
    sessionHistories = {};
    sessionHistories[socketId] = [];
    sessionHistories[socketId].push(
      { role: "system", content: collarText },
      { role: "user", content: userPrompt }
    );
  } else {
    sessionHistories[socketId].push(
      { role: "user", content: userPrompt },
      { role: "assistant", content: finalContent }
    );
  }
  return sessionHistories[socketId];
}

async function handleMessage(userPrompt, socketId) {
  if (!userPrompt) {
    console.error(bambisleepChalk.error('No user prompt provided'));
    return;
  }

  const modelId = await getLoadedModels();
  if (!modelId) {
    console.error(bambisleepChalk.error('Model loading failed'));
    return;
  }
  role = await checkRole();
  //console.log("role: ", role);
  
  collar = await checkTriggers(triggers);
  if (collarText) {
    collarText = '';
    collarText = (role + collar);
  } else {
    collarText = (role + collar);
  }
  if (!finalContent) {
    finalContent = '';
  }

  const messages = await getMessages(collarText, userPrompt, finalContent, socketId); // Await the messages
  //console.info(bambisleepChalk.info('Messages found for socketId:'), bambisleepChalk.tertiary(socketId), bambisleepChalk.tertiary(messages)); // Log the messages
  if (messages.length === 0) {
    console.error(bambisleepChalk.error('No messages found for socketId:'), bambisleepChalk.tertiary(socketId));
    return;
  }

  const requestData = {
    model: modelId,
    messages: messages,
    max_tokens: 360,
    temperature: 0.95,
    top_p: 0.95,
    frequency_penalty: 0,
    presence_penalty: 0,
    top_k: 40,
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
      console.info(bambisleepChalk.success('Response data stream ended'));
      await saveSessionHistories(collarText, userPrompt, finalContent, socketId);
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
    try {
      await saveSessionHistoryToFile(socketId);
    } catch (err) {
      console.error(bambisleepChalk.error('Error saving session history:'), err);
    } finally {
      console.info(bambisleepChalk.success(`Session history written to file: ${bambisleepChalk.tertiary(socketId)}`));
    }
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
          console.log(bambisleepChalk.success(`Session history saved for socketId: ${bambisleepChalk.tertiary(socketId)}`));
        }
      });
    } catch (err) {
      console.error(bambisleepChalk.error('Unexpected error occurred while saving session history:'), err);
    }
  } else {
    console.log(bambisleepChalk.warning(`No session history found for socketId: ${bambisleepChalk.tertiary(socketId)}`));
  }
}