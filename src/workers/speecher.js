import { parentPort } from 'worker_threads';
import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// F5-TTS Socket server configuration
dotenv.config();

const TTS_SOCKET_HOST = process.env.SPEECH_HOST || '127.0.0.1';
const TTS_SOCKET_PORT = parseInt(process.env.SPEECH_PORT, 10) || 9000;
const HTTP_API_PORT = parseInt(process.env.TTS_HTTP_PORT, 10) || 7860;
const OUTPUT_DIR = path.join(__dirname, '..', 'temp', 'audio');

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function log(message) {
  parentPort.postMessage({
    type: 'log',
    data: message
  });
}

// Socket server and HTTP API processes
let socketServerProcess = null;
let httpApiProcess = null;

// Start the F5-TTS Socket server
async function startSocketServer() {
  try {
    // First check if server is already running
    const serverRunning = await checkServerStatus();
    if (serverRunning) {
      log('F5-TTS socket server is already running');
      return true;
    }

    log('Starting F5-TTS socket server...');
    
    // Use different commands for Windows vs WSL
    const isWindows = process.platform === 'win32';
    const pythonCmd = isWindows ? 'python' : 'python3';
    
    // Start the server process
    socketServerProcess = spawn(pythonCmd, ['-m', 'f5_tts.socket_server']);
    
    // Log stdout and stderr
    socketServerProcess.stdout.on('data', (data) => {
      log(`F5-TTS server: ${data.toString().trim()}`);
    });
    
    socketServerProcess.stderr.on('data', (data) => {
      log(`F5-TTS server error: ${data.toString().trim()}`);
    });
    
    socketServerProcess.on('error', (error) => {
      log(`F5-TTS server process error: ${error.message}`);
    });
    
    socketServerProcess.on('close', (code) => {
      log(`F5-TTS server process exited with code ${code}`);
      socketServerProcess = null;
    });
    
    // Wait for server to start accepting connections
    let attempts = 0;
    const maxAttempts = 20;
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const serverUp = await checkServerStatus();
      if (serverUp) {
        log('F5-TTS socket server started successfully');
        
        // Now start the HTTP API (only if socket server is running)
        startHttpApi();
        return true;
      }
      attempts++;
      log(`Waiting for F5-TTS socket server to start... (${attempts}/${maxAttempts})`);
    }
    
    log('Failed to start F5-TTS socket server after multiple attempts');
    return false;
  } catch (error) {
    log(`Error starting F5-TTS socket server: ${error.message}`);
    return false;
  }
}

// Start the HTTP API server
function startHttpApi() {
  try {
    const isWindows = process.platform === 'win32';
    const pythonCmd = isWindows ? 'python' : 'python3';
    
    log('Starting F5-TTS HTTP API server...');
    
    // Start the HTTP API process
    httpApiProcess = spawn(pythonCmd, [
      path.join(__dirname, '..', 'f5_tts.socket_client'),
      '--socket-host', TTS_SOCKET_HOST,
      '--socket-port', TTS_SOCKET_PORT.toString(),
      '--api-port', HTTP_API_PORT.toString()
    ]);
    
    // Log stdout and stderr
    httpApiProcess.stdout.on('data', (data) => {
      log(`F5-TTS HTTP API: ${data.toString().trim()}`);
    });
    
    httpApiProcess.stderr.on('data', (data) => {
      log(`F5-TTS HTTP API error: ${data.toString().trim()}`);
    });
    
    httpApiProcess.on('error', (error) => {
      log(`F5-TTS HTTP API process error: ${error.message}`);
    });
    
    httpApiProcess.on('close', (code) => {
      log(`F5-TTS HTTP API process exited with code ${code}`);
      httpApiProcess = null;
    });
    
    log(`F5-TTS HTTP API available at http://localhost:${HTTP_API_PORT}/api/tts?text=hello`);
  } catch (error) {
    log(`Error starting F5-TTS HTTP API: ${error.message}`);
  }
}

// Check if the socket server is running by attempting to connect
async function checkServerStatus() {
  return new Promise((resolve) => {
    const testSocket = new net.Socket();
    
    const onError = () => {
      testSocket.destroy();
      resolve(false);
    };
    
    testSocket.setTimeout(500);
    testSocket.once('error', onError);
    testSocket.once('timeout', onError);
    
    testSocket.connect(TTS_SOCKET_PORT, TTS_SOCKET_HOST, () => {
      testSocket.end();
      resolve(true);
    });
  });
}

// Generate TTS using the F5-TTS Socket server
async function generateTTS(text, referenceAudio = null) {
  // Check if server is running
  let serverRunning = await checkServerStatus();
  
  // If server is not running, try to start it
  if (!serverRunning) {
    serverRunning = await startSocketServer();
    if (!serverRunning) {
      throw new Error('Failed to start F5-TTS socket server');
    }
  }
  
  log(`Making TTS request: ${text}`);
  
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let audioData = Buffer.alloc(0);
    
    client.connect(TTS_SOCKET_PORT, TTS_SOCKET_HOST, () => {
      // Prepare the request
      const request = {
        text: text,
        streaming: false
      };
      
      if (referenceAudio) {
        request.speaker_id = referenceAudio;
      }
      
      // Send the request
      client.write(JSON.stringify(request) + '\n');
    });
    
    client.on('data', (data) => {
      audioData = Buffer.concat([audioData, data]);
    });
    
    client.on('close', () => {
      if (audioData.length === 0) {
        reject(new Error('No audio data received from TTS server'));
        return;
      }
      
      // Generate unique filename for the output
      const outputFilename = `${Date.now()}_${Math.floor(Math.random() * 10000)}.wav`;
      const outputPath = path.join(OUTPUT_DIR, outputFilename);
      
      try {
        // Create a WAV file with the received audio data
        const wavHeader = Buffer.alloc(44);
        
        // RIFF chunk descriptor
        wavHeader.write('RIFF', 0);
        wavHeader.writeUInt32LE(36 + audioData.length, 4); // File size
        wavHeader.write('WAVE', 8);
        
        // "fmt " sub-chunk
        wavHeader.write('fmt ', 12);
        wavHeader.writeUInt32LE(16, 16); // Subchunk size
        wavHeader.writeUInt16LE(1, 20); // PCM format
        wavHeader.writeUInt16LE(1, 22); // Mono channel
        wavHeader.writeUInt32LE(24000, 24); // Sample rate (24kHz for F5-TTS)
        wavHeader.writeUInt32LE(24000 * 2, 28); // Byte rate
        wavHeader.writeUInt16LE(2, 32); // Block align
        wavHeader.writeUInt16LE(16, 34); // Bits per sample
        
        // "data" sub-chunk
        wavHeader.write('data', 36);
        wavHeader.writeUInt32LE(audioData.length, 40); // Data size
        
        // Write WAV file with header and audio data
        fs.writeFileSync(outputPath, Buffer.concat([wavHeader, audioData]));
        
        log(`Generated audio saved to: ${outputPath}`);
        resolve(outputPath);
      } catch (error) {
        reject(error);
      }
    });
    
    client.on('error', (error) => {
      reject(new Error(`Socket connection error: ${error.message}`));
    });
  });
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
  } else if (message.type === 'clearCache') {
    // Make a request to clear the cache
    try {
      const response = await fetch(`http://localhost:${HTTP_API_PORT}/api/clear-cache`);
      if (response.ok) {
        log('TTS cache cleared successfully');
        parentPort.postMessage({
          id: message.id,
          success: true
        });
      } else {
        throw new Error(`Failed to clear cache: ${response.statusText}`);
      }
    } catch (error) {
      log(`Error clearing TTS cache: ${error.message}`);
      parentPort.postMessage({
        id: message.id,
        error: `Failed to clear cache: ${error.message}`
      });
    }
  }
});

// Make sure to clean up processes on exit
process.on('exit', () => {
  if (socketServerProcess) {
    socketServerProcess.kill();
  }
  if (httpApiProcess) {
    httpApiProcess.kill();
  }
});

log('Speecher worker initialized and ready for TTS requests');