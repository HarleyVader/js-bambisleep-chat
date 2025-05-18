import Logger from './logger.js';
import SessionRecovery from './sessionRecovery.js';
import { withDbConnection } from '../config/db.js';

const logger = new Logger('ScheduledTasks');

/**
 * Scheduled Tasks Manager
 * Runs periodic maintenance tasks
 */
class ScheduledTasks {
  constructor() {
    this.tasks = [];
    this.isRunning = false;
  }
  
  /**
   * Initialize scheduled tasks
   */
  initialize() {
    if (this.isRunning) {
      logger.warning('Scheduled tasks already running');
      return this;
    }
    
    logger.info('Initializing scheduled tasks');
    
    // Register tasks
    this.registerTask('cleanupOldSessions', async () => {
      logger.info('Running old session cleanup task');
      
      try {
        await withDbConnection(async () => {
          const cleanedCount = await SessionRecovery.cleanupOldSessions(30);
          logger.info(`Cleaned up ${cleanedCount} old sessions`);
        });
      } catch (error) {
        logger.error(`Error in session cleanup task: ${error.message}`);
      }
    }, 24 * 60 * 60 * 1000); // Run once a day
    
    this.isRunning = true;
    logger.success('Scheduled tasks initialized');
    
    return this;
  }
  
  /**
   * Register a new scheduled task
   * 
   * @param {string} name - Name of the task
   * @param {Function} callback - Task function
   * @param {number} interval - Interval in milliseconds
   */
  registerTask(name, callback, interval) {
    if (!name || !callback || !interval) {
      logger.error('Invalid task parameters');
      return false;
    }
    
    // Create task object
    const task = {
      name,
      callback,
      interval,
      lastRun: null,
      intervalId: null
    };
    
    // Schedule task
    task.intervalId = setInterval(async () => {
      logger.info(`Running scheduled task: ${name}`);
      
      try {
        await callback();
        task.lastRun = Date.now();
      } catch (error) {
        logger.error(`Error running scheduled task ${name}: ${error.message}`);
      }
    }, interval);
    
    // Add to tasks list
    this.tasks.push(task);
    
    logger.info(`Registered scheduled task: ${name} (interval: ${interval / 1000}s)`);
    return true;
  }
  
  /**
   * Run a task immediately
   * 
   * @param {string} name - Name of the task to run
   */
  async runTaskNow(name) {
    const task = this.tasks.find(t => t.name === name);
    
    if (!task) {
      logger.error(`Task not found: ${name}`);
      return false;
    }
    
    logger.info(`Running task now: ${name}`);
    
    try {
      await task.callback();
      task.lastRun = Date.now();
      return true;
    } catch (error) {
      logger.error(`Error running task ${name}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Stop all scheduled tasks
   */
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.tasks.forEach(task => {
      if (task.intervalId) {
        clearInterval(task.intervalId);
      }
    });
    
    this.tasks = [];
    this.isRunning = false;
    
    logger.info('All scheduled tasks stopped');
  }
}

// Export singleton instance
const scheduledTasks = new ScheduledTasks();
export default scheduledTasks;
