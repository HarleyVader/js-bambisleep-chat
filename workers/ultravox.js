import dotenv from 'dotenv';
import { parentPort } from 'worker_threads';
import { UltravoxClientModule } from 'ultravox-client';
import { colors } from '../middleware/bambisleepChalk.js';

dotenv.config();

let sessionId = null;

const handleError = (error) => {
  console.error('Ultravox error:', error);
  parentPort?.postMessage({
    type: 'error',
    error: error.message || 'Unknown error occurred'
  });
};

class UltravoxService {
  constructor() {
    this.apiKey = process.env.ULTRAVOX_API_KEY || 'YH7tKu4C.bttepuuXdTXYKbLxfVBPfjee4gw2dDa2';
    this.apiEndpoint = process.env.ULTRAVOX_API_ENDPOINT || 'https://api.ultravox.ai';

    console.log(colors.primary('API Key:'), this.apiKey);
    console.log(colors.primaryAlt('API Endpoint:'), this.apiEndpoint);

    if (!this.apiKey || !this.apiEndpoint) {
      throw new Error('ULTRAVOX_API_KEY or ULTRAVOX_API_ENDPOINT is not defined');
    }
  }

  async initializeSession() {
    try {
      this.ultravox = new UltravoxClientModule.UltravoxClient({
        apiKey: this.apiKey,
        apiEndpoint: this.apiEndpoint,
        timeout: 30000
      });
      const session = await this.ultravox.joinCall('your_join_url');
      return session;
    } catch (error) {
      console.error('Ultravox error:', error.message);
      throw error;
    }
  }

  async synthesizeSpeech(text) {
    try {
      const audio = await this.ultravox.synthesize(text);
      return audio;
    } catch (error) {
      console.error('Speech synthesis error:', error.message);
      throw error;
    }
  }

  async transcribeSpeech(audioBuffer) {
    try {
      const response = await this.ultravox.sendData({ type: 'transcribe', audio: audioBuffer });
      return response.text;
    } catch (error) {
      console.error('Transcription error:', error.message);
      throw error;
    }
  }

  async terminateSession() {
    try {
      await this.ultravox.leaveCall();
    } catch (error) {
      console.error('Session termination error:', error.message);
      throw error;
    }
  }

  async fetchCalls() {
    try {
      const response = await fetch(`${apiEndpoint}/calls`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey
        }
      });
      const data = await response.json();
      console.log(data);
    } catch (error) {
      console.error('Error:', error);
    }
  }
}

const ultravoxService = new UltravoxService();

if (parentPort) {
  parentPort.on('message', async (message) => {
    try {
      switch (message.type) {
        case 'start':
          if (!sessionId && ultravoxService) {
            sessionId = await ultravoxService.initializeSession();
            parentPort.postMessage({
              type: 'conversationStarted',
              sessionId
            });
          }
          break;

        case 'stop':
          if (sessionId) {
            await ultravoxService.terminateSession();
            sessionId = null;
            parentPort.postMessage({ type: 'conversationStopped' });
          }
          break;

        case 'speak':
          if (sessionId) {
            const audio = await ultravoxService.synthesizeSpeech(message.text);
            parentPort.postMessage({
              type: 'speech',
              audio: audio,
              text: message.text
            });
          }
          break;

        case 'transcribe':
          if (sessionId) {
            const text = await ultravoxService.transcribeSpeech(message.audio);
            parentPort.postMessage({
              type: 'transcription',
              text: text
            });
          }
          break;
      }
    } catch (error) {
      handleError(error);
    }
  });
}

// Cleanup on exit
process.on('exit', () => {
  if (sessionId) {
    ultravoxService.terminateSession().catch(handleError);
  }
});

export { UltravoxService };
