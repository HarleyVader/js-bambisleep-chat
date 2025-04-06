import { parentPort } from 'worker_threads';
import { promises as fsPromises } from 'fs';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Setup logging
const logger = {
  info: (message) => sendLog('info', message),
  success: (message) => sendLog('success', message),
  error: (message) => sendLog('error', message),
  warning: (message) => sendLog('warning', message)
};

function sendLog(level, message) {
  parentPort.postMessage({
    type: 'log',
    level,
    data: message
  });
}

// Create necessary directories if they don't exist
// Use path.resolve to get the absolute path to the project root
const projectRoot = path.resolve(process.cwd());
const audioDir = path.join(projectRoot, 'temp', 'audio');

fs.mkdirSync(audioDir, { recursive: true });
logger.info(`Audio directory: ${audioDir}`);

/**
 * Generates speech using F5-TTS with voice cloning
 * @param {string} text - Text to convert to speech
 * @param {Buffer|string} refAudio - Reference audio for voice cloning (Buffer or file path)
 * @param {string} refText - Optional transcription of reference audio
 * @returns {Promise<{audioPath: string, error: string|null}>}
 */
async function generateF5TTS(text, refAudio, refText = "") {
  return new Promise(async (resolve, reject) => {
    try {
      const sessionId = uuidv4();
      const refAudioPath = path.join(audioDir, `ref_${sessionId}.wav`);
      const outputPath = path.join(audioDir, `output_${sessionId}.wav`);

      // If refAudio is a Buffer, write it to a file
      if (Buffer.isBuffer(refAudio)) {
        await fsPromises.writeFile(refAudioPath, refAudio);
      } else if (typeof refAudio === 'string') {
        // If it's a path, copy it to our temp location
        await fsPromises.copyFile(refAudio, refAudioPath);
      } else {
        return reject(new Error('Reference audio must be a Buffer or file path'));
      }

      // Prepare arguments for F5-TTS command
      const args = [
        '-m', 'F5TTS_v1_Base',
        '--ref_audio', refAudioPath,
        '--gen_text', text,
        '--output_dir', audioDir,
        '--output_name', `output_${sessionId}`
      ];

      // Add reference text if provided
      if (refText && refText.trim() !== '') {
        args.push('--ref_text', refText);
      }

      // Spawn F5-TTS process
      logger.info(`Generating speech with F5-TTS: ${text}`);
      const f5tts = spawn('f5-tts_infer-cli', args);

      let stderr = '';

      f5tts.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.info(`F5-TTS stderr: ${data}`);
      });

      f5tts.on('close', (code) => {
        if (code !== 0) {
          logger.error(`F5-TTS process exited with code ${code}`);
          logger.error(`Error: ${stderr}`);
          resolve({ audioPath: null, error: stderr || 'Error generating speech' });
        } else {
          logger.success('F5-TTS generation complete');
          resolve({ audioPath: outputPath, error: null });
        }
      });

      f5tts.on('error', (err) => {
        logger.error(`F5-TTS spawn error: ${err.message}`);
        resolve({ audioPath: null, error: err.message });
      });

    } catch (error) {
      logger.error(`Error in generateF5TTS: ${error.message}`);
      resolve({ audioPath: null, error: error.message });
    }
  });
}

/**
 * Generates standard TTS using external service
 * @param {string} text - Text to convert to speech
 * @returns {Promise<{audioPath: string, error: string|null}>}
 */
async function generateTTS(text) {
  try {
    const sessionId = uuidv4();
    const outputPath = path.join(audioDir, `tts_${sessionId}.wav`);

    logger.info(`Generating standard TTS: ${text}`);
    
    const response = await axios.get(`http://${process.env.SPEECH_HOST}:${process.env.SPEECH_PORT}/api/tts`, {
      params: { text },
      responseType: 'arraybuffer',
    });
    
    await fsPromises.writeFile(outputPath, response.data);
    logger.success('Standard TTS generation complete');
    
    return { audioPath: outputPath, error: null };
  } catch (error) {
    logger.error(`Error in generateTTS: ${error.message}`);
    return { audioPath: null, error: error.message };
  }
}

// Handle messages from the main thread
parentPort.on('message', async (message) => {
  try {
    const { type, id, text, refAudio, refText } = message;
    
    if (type === 'tts') {
      // Standard TTS
      const result = await generateTTS(text);
      parentPort.postMessage({
        id,
        audioPath: result.audioPath,
        error: result.error
      });
    } 
    else if (type === 'f5tts') {
      // Voice cloning with F5-TTS
      const result = await generateF5TTS(text, refAudio, refText);
      parentPort.postMessage({
        id,
        audioPath: result.audioPath,
        error: result.error
      });
    }
  } catch (error) {
    logger.error(`Worker error: ${error.message}`);
    parentPort.postMessage({
      id: message.id,
      error: error.message
    });
  }
});

// Notify that worker is ready
parentPort.postMessage({ type: 'log', data: 'Speecher worker initialized' });