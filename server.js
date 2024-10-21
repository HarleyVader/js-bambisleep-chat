const express = require("express");
const os = require('os');
const path = require('path');
const fs = require("fs");
const http = require("http");
const { Worker } = require("worker_threads");
const { Server } = require("socket.io");
const readline = require("readline");
const cors = require('cors');
const axios = require("axios");
const chalk = require('chalk');

const bambisleepChalk = {
  primary: chalk.hex('#112727'),
  primaryAlt: chalk.hex('#216969'),
  secondary: chalk.hex('#1f0117'),
  tertiary: chalk.hex('#f2f2f2'),
  button: chalk.hex('#d4046c'),
  buttonAlt: chalk.hex('#110000'),
  error: chalk.hex('#d4046c').bold,
  success: chalk.hex('#216969').bold,
  info: chalk.hex('#017c8a').bold,
  warning: chalk.hex('#112727').bold
};

const PORT = 6969;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.setMaxListeners(20);

const filteredWords = require("./fw.json");
function filter(message) {
  if (typeof message !== "string") {
    message = String(message);
  }
  return message
    .split(" ")
    .map((word) => {
      return filteredWords.includes(word.toLowerCase()) ? " " : word;
    })
    .join(" ");
}

let userSessions = new Set();
let workers = new Map();
let socketStore = new Map();

app.use(cors({
  origin: 'https://bambisleep.chat',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.static(path.join(__dirname, "public")));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Ensure the directory for session histories exists
const sessionHistoriesDir = path.join(__dirname, 'history');
if (!fs.existsSync(sessionHistoriesDir)) {
  fs.mkdirSync(sessionHistoriesDir, { recursive: true });
}

// Ensure the chat history file exists
const chatHistoryPath = path.join(__dirname, 'public', 'chatHistory.json');
const chatHistoryDir = path.dirname(chatHistoryPath);

if (!fs.existsSync(chatHistoryDir)) {
  fs.mkdirSync(chatHistoryDir, { recursive: true });
}

if (!fs.existsSync(chatHistoryPath)) {
  fs.writeFileSync(chatHistoryPath, JSON.stringify([]), 'utf8');
}

// Function to update chat history
function updateChatHistory(index, type, callback) {
  fs.readFile(chatHistoryPath, 'utf8', (err, data) => {
    if (err) {
      console.error(bambisleepChalk.error('Error reading chat history:'), err);
      return callback(err);
    }

    let chatHistory;
    try {
      chatHistory = data ? JSON.parse(data) : [];
    } catch (parseErr) {
      console.error(bambisleepChalk.error('Error parsing chat history JSON:'), parseErr);
      chatHistory = [];
    }

    if (type === 'up') {
      chatHistory[index].votes = (chatHistory[index].votes || 0) + 1;
    } else if (type === 'down') {
      chatHistory[index].votes = (chatHistory[index].votes || 0) - 1;
    }

    fs.writeFile(chatHistoryPath, JSON.stringify(chatHistory), (err) => {
      if (err) {
        console.error(bambisleepChalk.error('Error saving chat history:'), err);
        return callback(err);
      }
      callback(null, chatHistory[index].votes);
    });
  });
}

// Rate limiter middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes"
});

app.use(limiter);

// Handle connection
io.on("connection", (socket) => {
  userSessions.add(socket.id);

  // Create a new worker for this client
  const worker = new Worker("./worker.js");
  workers.set(socket.id, worker);

  // Store the socket object in the shared context
  socketStore.set(socket.id, socket);
  console.log(bambisleepChalk.info(`Client connected: ${socket.id} clients: ${userSessions.size} sockets: ${socketStore.size} workers: ${workers.size}`));

  // Ensure socket.request.app is defined
  socket.request.app = app;

  // Handle HTTP requests within the socket connection
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  app.get('/history', (req, res) => {
    fs.readFile(chatHistoryPath, 'utf8', (err, data) => {
      if (err) {
        console.error(bambisleepChalk.error('Error reading chat history:'), err);
        res.status(500).send('Error reading chat history');
        return;
      }

      let chatHistory;
      try {
        chatHistory = data ? JSON.parse(data) : [];
      } catch (parseErr) {
        console.error(bambisleepChalk.error('Error parsing chat history JSON:'), parseErr);
        chatHistory = [];
      }

      res.render('history', { chatHistory });
    });
  });

  app.get('/updateChatHistory/:index/:type', (req, res) => {
    const index = req.params.index;
    const type = req.params.type;

    updateChatHistory(index, type, (err, votes) => {
      if (err) {
        res.status(500).send('Error updating chat history');
      } else {
        res.json({ votes });
      }
    });
  });

  app.post('/vote/:index/:type', (req, res) => {
    const index = req.params.index;
    const type = req.params.type;

    updateChatHistory(index, type, (err, votes) => {
      if (err) {
        res.status(500).send('Error updating chat history');
      } else {
        res.json({ votes });
      }
    });
  });

  app.get("/help", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "help.html"));
  });

  app.get("/psychodelic-trigger-mania", (req, res) => {
    res.sendFile(
      path.join(__dirname, "public", "psychodelic-trigger-mania.html")
    );
  });

  socket.on("message", (message) => {
    const filteredMessage = filter(message);
    worker.postMessage({
      type: "message",
      data: filteredMessage,
      triggers: "",
      socketId: socket.id,
    });
  });

  socket.on("triggers", (triggers) => {
    worker.postMessage({ type: "triggers", triggers });
  });

  socket.on("disconnect", () => {
    worker.postMessage({ type: "terminate", socketId: socket.id });
    terminator(socket.id);
  });

  worker.on('info', () => {
    console.info(bambisleepChalk.info('Worker error:'), info);
  });

  worker.on('error', (err) => {
    console.error(bambisleepChalk.error('Worker error:'), err);
  });

  worker.on("message", async (msg) => {
    if (msg.type === "log") {
      console.log(bambisleepChalk.info(msg.data, msg.socketId));
    } else if (msg.type === 'response') {
      const responseData = typeof msg.data === 'object' ? JSON.stringify(msg.data) : msg.data;
      io.to(msg.socketId).emit("response", responseData);
    } else if (msg.type === 'terminate') {
      terminator(msg.socketId);
    }
  });

  worker.on("exit", (code) => {
    console.log(bambisleepChalk.warning(`Worker stopped with exit code ${code}`));
  });

  function terminator(socketId) {
    if (userSessions.has(socketId)) {
      userSessions.delete(socketId);
    }
    if (socketStore.has(socketId)) {
      const socket = socketStore.get(socketId);
      socket.disconnect(true); // Forcefully disconnect the socket
      socketStore.delete(socketId);
    }
    if (workers.has(socketId)) {
      workers.get(socketId).terminate();
      workers.delete(socketId);
    }
    console.log(bambisleepChalk.warning(`Client disconnected: ${socketId} clients: ${userSessions.size} sockets: ${socketStore.size} workers: ${workers.size}`));
  }
  
  rl.on("line", async (line) => {
    if (line === "update") {
      console.log(bambisleepChalk.success("Update mode"));
      io.emit("update");
    } else if (line === "normal") {
      io.emit("update");
      console.log(bambisleepChalk.success("Normal mode"));
    } else if (line === "save") {
      for (const socketId of userSessions) {
        await workersSessionHistories(socketId);
      }
    } else if (line === "terminate") {
      for (const socketId of userSessions) {
        terminator(socketId);
      }
    } else {
      console.log(bambisleepChalk.error("Invalid command! Use 'update', 'normal', 'save', 'terminate'"));
    }
  });
});

app.use("/api/tts", (req, res) => {
  const text = req.query.text;
  if (typeof text !== "string") {
    return res.status(400).send("Invalid input: text must be a string");
  } else {
    axios
      .get(`http://192.168.0.178:5002/api/tts`, {
        params: { text },
        responseType: 'arraybuffer'
      })
      .then((response) => {
        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Content-Length", response.data.length);
        res.send(response.data);
      })
      .catch((error) => {
        console.error(bambisleepChalk.error("Error fetching TTS audio:"), error);
        console.error(bambisleepChalk.error("Error details:"), error.response ? error.response.data : error.message);
        res.status(500).send("Error fetching TTS audio");
      });
  }
});

function getServerAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Start the server
server.listen(PORT, () => {
  console.log(bambisleepChalk.success(`Server is running on http://${getServerAddress()}:${PORT}`));
});



/* removed /images due to lack of images to show
socket.request.app.use("/images", express.static(path.join(__dirname, "images")));

socket.request.app.get("/images", async (req, res) => {
  const directoryPath = path.join(__dirname, "images");
  const files = await fs.readdir(directoryPath);
  let html = "<html><body>";
  files.forEach((file) => {
    if (
      file.endsWith(".png") ||
      file.endsWith(".jpg") ||
      file.endsWith(".jpeg")
    ) {
      html += `<img src="/images/${file}" width="64" height="64" />`;
    }
  });
  html += "</body></html>";
  res.send(html);
});
*/

/*
const { MongoClient } = require('mongodb');
const axios = require("axios");
const WebSocket = require('ws');

const uri = "mongodb://localhost:27017"; // Replace with your MongoDB connection string
const clientDB = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

clientDB.connect(err => {
    if (err) {
        console.error('Error connecting to MongoDB:', err);
        return;
    }
    console.log('Connected to MongoDB');
    const db = clientDB.db('chatDB');
    const messagesCollection = db.collection('messages');

    // Save client message and LLM replies
    io.on('connection', (socket) => {
        socket.on('message', async (prompt) => {
            const timestamp = new Date();
            const message = {
                socketId: socket.id,
                timestamp: timestamp,
                prompt: prompt,
                reply: null
            };

            try {
                // Save the client message
                await messagesCollection.insertOne(message);
                console.log('Client message saved to MongoDB');

                // Generate reply from LLM
                const reply = await client.llm.generate(prompt);
                message.reply = reply;

                // Save the reply
                await messagesCollection.updateOne(
                    { _id: message._id },
                    { $set: { reply: reply } }
                );
                console.log('LLM reply saved to MongoDB');

                // Send the reply back to the client
                socket.emit('message', reply);
            } catch (error) {
                console.error('Error saving message or generating reply:', error);
            }
        });
    });
});
*/
