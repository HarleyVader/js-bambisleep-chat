import { parentPort } from 'worker_threads';
import { exec } from 'child_process';
import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// F5-TTS Flask server configuration
const TTS_SERVER_URL = 'http://172.22.78.155:5002';
const OUTPUT_DIR = path.join(__dirname, '..', 'temp', 'audio');

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function log(message) {
  parentPort.postMessage({
    type: 'log',
    data: message
  });
}

// Start the F5-TTS Flask server
async function startFlaskServer() {
  try {
    // First check if server is already running
    const serverRunning = await checkServerStatus();
    if (serverRunning) {
      log('F5-TTS server is already running');
      return true;
    }

    // Get the path to the server script
    const serverPath = path.join(__dirname, '..', '..', 'f5-tts-app', 'server.py');
    
    if (!fs.existsSync(serverPath)) {
      log(`F5-TTS server not found at: ${serverPath}`);
      return false;
    }
    
    log('Starting F5-TTS Flask server...');
    
    // Use different commands for Windows vs WSL
    const isWindows = process.platform === 'win32';
    const serverCommand = isWindows 
      ? `python "${serverPath}" --port 5002`
      : `python3 "${serverPath}" --port 5002`;
    
    // Start the server asynchronously
    const process = exec(serverCommand);
    
    // Log stdout and stderr
    process.stdout.on('data', (data) => {
      log(`F5-TTS server: ${data.trim()}`);
    });
    
    process.stderr.on('data', (data) => {
      log(`F5-TTS server error: ${data.trim()}`);
    });
    
    // Wait for server to start accepting connections
    let attempts = 0;
    const maxAttempts = 20;
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const serverUp = await checkServerStatus();
      if (serverUp) {
        log('F5-TTS server started successfully');
        return true;
      }
      attempts++;
      log(`Waiting for F5-TTS server to start... (${attempts}/${maxAttempts})`);
    }
    
    log('Failed to start F5-TTS server after multiple attempts');
    return false;
  } catch (error) {
    log(`Error starting F5-TTS server: ${error.message}`);
    return false;
  }
}

// Check if the server is running
async function checkServerStatus() {
  try {
    const response = await fetch(`${TTS_SERVER_URL}/health`, { timeout: 2000 });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Generate TTS using the F5-TTS Flask server
async function generateTTS(text, referenceAudio = null) {
  // Check if server is running
  let serverRunning = await checkServerStatus();
  
  // If server is not running, try to start it
  if (!serverRunning) {
    serverRunning = await startFlaskServer();
    if (!serverRunning) {
      throw new Error('Failed to start F5-TTS server');
    }
  }
  
  // Build the request URL
  let url = `${TTS_SERVER_URL}/api/tts?text=${encodeURIComponent(text)}`;
  if (referenceAudio) {
    url += `&reference_audio=${encodeURIComponent(referenceAudio)}`;
  }
  
  log(`Making TTS request: ${text}`);
  
  // Make the TTS request
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS request failed: ${errorText}`);
  }
  
  // Generate unique filename for the output
  const outputFilename = `${Date.now()}_${Math.floor(Math.random() * 10000)}.wav`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);
  
  // Save the audio file
  const buffer = await response.buffer();
  fs.writeFileSync(outputPath, buffer);
  
  log(`Generated audio saved to: ${outputPath}`);
  return outputPath;
}

// Initialize worker
log('Speecher worker initializing...');

// Handle incoming messages
parentPort.on('message', async (message) => {
  if (message.type === 'tts') {
    try {
      const text = message.text;
      const referenceAudio = message.referenceAudio;
      
      log(`Generating TTS for: ${text}`);
      
      // Generate the audio
      const audioPath = await generateTTS(text, referenceAudio);
      
      // Send back the result
      parentPort.postMessage({
        id: message.id,
        audioPath: audioPath
      });
    } catch (error) {
      log(`Error in TTS generation: ${error.message}`);
      parentPort.postMessage({
        id: message.id,
        error: `Failed to generate audio: ${error.message}`
      });
    }
  }
});

log('Speecher worker initialized and ready for TTS requests');