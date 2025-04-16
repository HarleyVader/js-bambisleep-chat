import { patterns } from '../middleware/bambisleepChalk.js';
import chalk from 'chalk';

/**
 * Unified logging utility for bambisleep-chat with enhanced visual formatting
 * Uses contrasting colors for message text vs prefix and highlights important elements
 */
class Logger {
  constructor(moduleName) {
    this.moduleName = moduleName;
    
    // Create contrasting text colors (swapped for visual impact)
    this.textColors = {
      info: patterns.server.warning,    // Info text uses warning color
      success: patterns.server.error,   // Success text uses error color
      warning: patterns.server.info,    // Warning text uses info color
      error: patterns.server.success    // Error text uses success color
    };

    // Special formatting colors
    this.specialColors = {
      number: chalk.hex('#01c69eae'),       // Teal green for numbers - from tertiaryAlt
      socket: chalk.hex('#17dbd8'),         // Marine blue for socket IDs - from navAlt
      url: chalk.hex('#01c69eae')           // Teal green for URLs - from tertiaryAlt
    };
  }

  /**
   * Format the timestamp for log messages
   * @returns {string} Formatted timestamp [HH:MM:SS]
   */
  getTimestamp() {
    const now = new Date();
    return `[${now.toLocaleTimeString([], {hour12: false})}]`;
  }

  /**
   * Format the module prefix for log messages
   * @returns {string} Formatted module name
   */
  getModulePrefix() {
    return this.moduleName ? `[${this.moduleName}]` : '';
  }

  /**
   * Apply special formatting to highlight numbers, socket IDs and URLs
   * @param {string} message - Original message text
   * @returns {string} Formatted message with highlighted elements
   */
  formatMessage(message) {
    if (typeof message !== 'string') {
      return message;
    }

    // Format numbers (integers, decimals, etc.)
    message = message.replace(/\b\d+(\.\d+)?\b/g, (match) => {
      return this.specialColors.number(match);
    });

    // Format socket IDs (typical format: alphanumeric strings)
    message = message.replace(/\b(socket\.id|socketId|socket id|socket:|socket=)([a-zA-Z0-9_-]+)\b/gi, (match, prefix, id) => {
      return `${prefix}${this.specialColors.socket(id)}`;
    });
    
    // Highlight standalone socket IDs that match typical socket.io format
    message = message.replace(/\b([a-zA-Z0-9_-]{20,22})\b/g, (match) => {
      return this.specialColors.socket(match);
    });

    // Format URLs and links
    message = message.replace(/(https?:\/\/[^\s]+)/g, (match) => {
      return this.specialColors.url(match);
    });
    
    // Format port numbers and host:port combinations
    message = message.replace(/(\w+:\/\/[\w.-]+):(\d+)/g, (match, host, port) => {
      return `${host}:${this.specialColors.number(port)}`;
    });
    
    // Format hostname:port combinations (like localhost:3000)
    message = message.replace(/(\b\w+):(\d+)\b/g, (match, host, port) => {
      return `${host}:${this.specialColors.number(port)}`;
    });

    return message;
  }

  /**
   * Log informational message with contrasting colors and special formatting
   * @param {string} message - The message to log
   * @param {any} data - Optional data to log
   */
  info(message, data) {
    const timestamp = this.getTimestamp();
    const prefix = this.getModulePrefix();
    console.log(
      patterns.server.info(`${timestamp} ${prefix} INFO:`), 
      this.textColors.info(this.formatMessage(message)), 
      data ? this.formatMessage(data) : ''
    );
  }

  /**
   * Log success message with contrasting colors and special formatting
   * @param {string} message - The message to log
   * @param {any} data - Optional data to log
   */
  success(message, data) {
    const timestamp = this.getTimestamp();
    const prefix = this.getModulePrefix();
    console.log(
      patterns.server.success(`${timestamp} ${prefix} SUCCESS:`), 
      this.textColors.success(this.formatMessage(message)), 
      data ? this.formatMessage(data) : ''
    );
  }

  /**
   * Log warning message with contrasting colors and special formatting
   * @param {string} message - The message to log
   * @param {any} data - Optional data to log
   */
  warning(message, data) {
    const timestamp = this.getTimestamp();
    const prefix = this.getModulePrefix();
    console.log(
      patterns.server.warning(`${timestamp} ${prefix} WARNING:`), 
      this.textColors.warning(this.formatMessage(message)), 
      data ? this.formatMessage(data) : ''
    );
  }

  /**
   * Log error message with contrasting colors and special formatting
   * @param {string} message - The message to log
   * @param {any} data - Optional data to log
   */
  error(message, data) {
    const timestamp = this.getTimestamp();
    const prefix = this.getModulePrefix();
    console.error(
      patterns.server.error(`${timestamp} ${prefix} ERROR:`), 
      this.textColors.error(this.formatMessage(message)), 
      data ? this.formatMessage(data) : ''
    );
  }

  /**
   * Log debug message with contrasting colors and special formatting
   * @param {string} message - The message to log
   * @param {...any} args - Optional arguments to log
   */
  debug(message, ...args) {
    const timestamp = this.getTimestamp();
    const prefix = this.getModulePrefix();
    console.log(
      patterns.server.info(`${timestamp} ${prefix} DEBUG:`), 
      this.textColors.info(this.formatMessage(message)), 
      ...args.map(arg => this.formatMessage(arg))
    );
  }
}

export default Logger;