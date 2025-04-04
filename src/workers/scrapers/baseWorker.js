import dotenv from 'dotenv';
import { colors, patterns } from '../../middleware/bambisleepChalk.js';

// Base worker class that others can extend
export class BaseWorker {
  constructor(name) {
    // Ensure dotenv is loaded
    dotenv.config();
    
    this.name = name;
    this.logger = {
      info: (message) => console.log(patterns.server.info(`[${this.name}]`), message),
      success: (message) => console.log(patterns.server.success(`[${this.name}]`), message),
      warning: (message) => console.log(patterns.server.warning(`[${this.name}]`), message),
      error: (message) => console.log(patterns.server.error(`[${this.name}]`), message)
    };
  }
  
  // Common worker methods
  start() {
    this.logger.info('Worker started and ready to receive messages');
  }
}