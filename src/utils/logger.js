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
      url: chalk.hex('#01c69eae'),          // Teal green for URLs - from tertiaryAlt
      bambi: chalk.hex('#ff9ce6'),          // Pink for bambi names
      worker: chalk.hex('#f7d56e')          // Gold for worker names
    };
    
    // Flags to control suppression of repetitive logs
    this.suppressTriggerUpdates = true;
    this.suppressConfigLogs = true;
    this.configLoggedOnce = false;
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
    
    // Format bambi names
    message = message.replace(/\b(bambi\s*name:|bambiName:|bambi:)\s*([a-zA-Z0-9_\s]+)\b/gi, (match, prefix, name) => {
      return `${prefix} ${this.specialColors.bambi(name)}`;
    });
    
    // Format worker references
    message = message.replace(/\b(worker[s]?:|worker\s*id:|workers:)\s*([a-zA-Z0-9_\-,\s]+)\b/gi, (match, prefix, name) => {
      return `${prefix} ${this.specialColors.worker(name)}`;
    });

    return message;
  }

  /**
   * Check if a message contains config-related content that should be suppressed
   * @param {string} message - The message to check
   * @returns {boolean} True if message should be suppressed
   */
  shouldSuppressMessage(message) {
    if (typeof message !== 'string') return false;
    
    // Check for trigger updates
    if (this.suppressTriggerUpdates && 
        (message.includes('triggers updated') || message.includes('Trigger updated'))) {
      return true;
    }
    
    // Check for config logs - more aggressive suppression
    if (this.suppressConfigLogs && 
       (message.toLowerCase().includes('config') || 
        message.toLowerCase().includes('configuration'))) {
      
      // Special case - always show server startup messages
      if (message.includes('===== SERVER STARTUP =====')) {
        return false;
      }
      
      // For config module specifically, only show the first config log
      if (this.moduleName === 'Config') {
        if (!Logger.configHasBeenLogged) {
          Logger.configHasBeenLogged = true;
          return false;
        }
        return true;
      }
      
      // For all other modules, suppress all config-related logs
      return true;
    }
    
    return false;
  }

  /**
   * Log informational message with contrasting colors and special formatting
   * @param {string} message - The message to log
   * @param {any} data - Optional data to log
   */
  info(message, data) {
    // Skip suppressed messages
    if (this.shouldSuppressMessage(message)) {
      return;
    }
    
    const timestamp = this.getTimestamp();
    const prefix = this.getModulePrefix();
    console.log(
      patterns.server.info(`${timestamp} ${prefix} INFO:`), 
      this.textColors.info(this.formatMessage(message)), 
      data ? this.formatMessage(data) : ''
    );
  }

  /**
   * Log config information once at server startup
   * @param {string} message - The message to log
   * @param {any} configData - The configuration data
   */
  logConfig(message, configData) {
    // If config has already been logged globally, don't log again
    if (Logger.configHasBeenLogged && this.suppressConfigLogs) {
      return;
    }
    
    const timestamp = this.getTimestamp();
    const prefix = this.getModulePrefix();
    
    console.log(
      patterns.server.info(`${timestamp} ${prefix} CONFIG:`), 
      this.textColors.info(this.formatMessage(message))
    );
    
    // Log sensitive values with masking
    if (configData) {
      const maskedConfig = {...configData};
      
      // Mask sensitive values
      for (const [key, value] of Object.entries(maskedConfig)) {
        if (key.includes('KEY') || key.includes('SECRET') || 
            key.includes('PASSWORD') || key.includes('TOKEN') ||
            key.includes('URI') || key.includes('URL')) {
          maskedConfig[key] = '******';
        }
      }
      
      // Print each config option on its own line for better readability
      for (const [key, value] of Object.entries(maskedConfig)) {
        console.log(
          patterns.server.info(`${timestamp} ${prefix} CONFIG:`),
          this.textColors.info(`  ${key}: ${value}`)
        );
      }
    }
    
    // Mark globally that config has been logged
    Logger.configHasBeenLogged = true;
  }

  /**
   * Log success message with contrasting colors and special formatting
   * @param {string} message - The message to log
   * @param {any} data - Optional data to log
   */
  success(message, data) {
    // Skip suppressed messages
    if (this.shouldSuppressMessage(message)) {
      return;
    }
    
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
    // Skip suppressed messages
    if (this.shouldSuppressMessage(message)) {
      return;
    }
    
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
    // Errors should never be suppressed
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
    // Skip suppressed messages
    if (this.shouldSuppressMessage(message)) {
      return;
    }
    
    const timestamp = this.getTimestamp();
    const prefix = this.getModulePrefix();
    console.log(
      patterns.server.info(`${timestamp} ${prefix} DEBUG:`), 
      this.textColors.info(this.formatMessage(message)), 
      ...args.map(arg => this.formatMessage(arg))
    );
  }
  
  /**
   * Log new socket connection with bambi information
   * @param {string} socketId - The socket ID
   * @param {string} bambiName - The name of the bambi
   * @param {Array} workers - Associated workers
   * @param {Array} dbConnections - Associated database connections
   * @param {number} totalConnections - Total number of active connections
   * @param {number} activeWorkers - Total number of active workers
   */
  socketConnect(socketId, bambiName, workers, dbConnections, totalConnections, activeWorkers) {
    const timestamp = this.getTimestamp();
    const prefix = this.getModulePrefix();
    
    console.log(
      patterns.server.success(`${timestamp} ${prefix} CONNECT:`),
      this.textColors.success(`Client connected (${this.specialColors.number(totalConnections)} total)`)
    );
    
    console.log(
      patterns.server.info(`${timestamp} ${prefix} CLIENT INFO:`),
      this.textColors.info(`Bambi: ${this.specialColors.bambi(bambiName || 'Unknown')}, Socket: ${this.specialColors.socket(socketId)}`)
    );
    
    if (workers && workers.length) {
      console.log(
        patterns.server.info(`${timestamp} ${prefix} WORKERS:`),
        this.textColors.info(`${this.specialColors.worker(workers.join(', '))}`)
      );
    }
    
    if (dbConnections && dbConnections.length) {
      console.log(
        patterns.server.info(`${timestamp} ${prefix} DB CONNECTIONS:`),
        this.textColors.info(`Count: ${this.specialColors.number(dbConnections.length)}`)
      );
    }
    
    console.log(
      patterns.server.info(`${timestamp} ${prefix} SERVER STATS:`),
      this.textColors.info(`Active Connections: ${this.specialColors.number(totalConnections)}, Active Workers: ${this.specialColors.number(activeWorkers)}`)
    );
  }
  
  /**
   * Log socket disconnection
   * @param {string} socketId - The socket ID
   * @param {string} bambiName - The name of the bambi
   * @param {number} totalConnections - Total number of active connections
   * @param {number} activeWorkers - Total number of active workers
   */
  socketDisconnect(socketId, bambiName, totalConnections, activeWorkers) {
    const timestamp = this.getTimestamp();
    const prefix = this.getModulePrefix();
    
    console.log(
      patterns.server.warning(`${timestamp} ${prefix} DISCONNECT:`),
      this.textColors.warning(`Client disconnected (${this.specialColors.number(totalConnections)} remaining)`)
    );
    
    console.log(
      patterns.server.info(`${timestamp} ${prefix} CLIENT INFO:`),
      this.textColors.info(`Bambi: ${this.specialColors.bambi(bambiName || 'Unknown')}, Socket: ${this.specialColors.socket(socketId)}`)
    );
    
    console.log(
      patterns.server.info(`${timestamp} ${prefix} SERVER STATS:`),
      this.textColors.info(`Active Connections: ${this.specialColors.number(totalConnections)}, Active Workers: ${this.specialColors.number(activeWorkers)}`)
    );
  }
  
  /**
   * Log garbage collection of a socket
   * @param {string} socketId - The socket ID
   * @param {string} bambiName - The name of the bambi
   */
  socketGarbageCollected(socketId, bambiName) {
    const timestamp = this.getTimestamp();
    const prefix = this.getModulePrefix();
    
    console.log(
      patterns.server.warning(`${timestamp} ${prefix} GARBAGE COLLECTION:`),
      this.textColors.warning(`Cleaned up disconnected client`)
    );
    
    console.log(
      patterns.server.info(`${timestamp} ${prefix} CLIENT INFO:`),
      this.textColors.info(`Bambi: ${this.specialColors.bambi(bambiName || 'Unknown')}, Socket: ${this.specialColors.socket(socketId)}`)
    );
  }
}

// Add this static property at the end of the file, after the class declaration
// This ensures config is only logged once across all logger instances
Logger.configHasBeenLogged = false;

export default Logger;