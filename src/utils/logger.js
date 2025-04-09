// src/utils/logger.js
import chalk from 'chalk';
import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { patterns } from './base/colors.js';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configure Winston logger
const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logsDir, 'combined.log') })
  ]
});

export class Logger {
  constructor(moduleName) {
    this.moduleName = moduleName;
  }

  info(message) {
    console.log(patterns.server.info(`[${this.moduleName}]`), message);
    winstonLogger.info({ module: this.moduleName, message });
  }

  success(message) {
    console.log(patterns.server.success(`[${this.moduleName}]`), message);
    winstonLogger.info({ module: this.moduleName, message, level: 'success' });
  }

  warning(message) {
    console.log(patterns.server.warning(`[${this.moduleName}]`), message);
    winstonLogger.warn({ module: this.moduleName, message });
  }

  error(message, error) {
    console.error(patterns.server.error(`[${this.moduleName}]`), message);
    if (error) console.error(error);
    winstonLogger.error({ module: this.moduleName, message, error: error ? error.stack : null });
  }
}

// Create default logger
const defaultLogger = new Logger('Default');

// Export function-based API for backward compatibility
export const logInfo = (message) => defaultLogger.info(message);
export const logSuccess = (message) => defaultLogger.success(message);
export const logWarning = (message) => defaultLogger.warning(message);
export const logError = (message) => defaultLogger.error(message);

export default defaultLogger;