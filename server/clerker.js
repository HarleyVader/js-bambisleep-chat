const { parentPort } = require('worker_threads');
const { clerkClient, requireAuth, getAuth } = require('@clerk/express');
const express = require('express');
const app = express();

app.use(express.json());

// Registration route
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await clerkClient.users.createUser({
      emailAddress: email,
      password,
    });
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const session = await clerkClient.sessions.createSession({
      emailAddress: email,
      password,
    });
    res.status(200).json({ message: 'User logged in successfully', session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Account page route
app.get('/account', requireAuth(), async (req, res) => {
  try {
    const auth = getAuth(req);
    const userId = auth.userId;
    const user = await clerkClient.users.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listen for messages from the parent thread
parentPort.on('message', async (msg) => {
  const { type, data } = msg;

  if (type === 'register') {
    const req = { body: data };
    const res = {
      status: (code) => ({
        json: (response) => parentPort.postMessage({ socketId: data.socketId, response: { status: code, ...response } })
      })
    };
    app.handle(req, res);
  } else if (type === 'login') {
    const req = { body: data };
    const res = {
      status: (code) => ({
        json: (response) => parentPort.postMessage({ socketId: data.socketId, response: { status: code, ...response } })
      })
    };
    app.handle(req, res);
  } else if (type === 'account') {
    const req = { headers: { authorization: `Bearer ${data.token}` } };
    const res = {
      status: (code) => ({
        json: (response) => parentPort.postMessage({ socketId: data.socketId, response: { status: code, ...response } })
      })
    };
    app.handle(req, res);
  }
});