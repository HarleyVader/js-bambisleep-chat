import mongoose from 'mongoose';
import Logger from './logger.js';

const logger = new Logger('SessionRecovery');

/**
 * Session recovery utility
 * Provides methods to find and recover abandoned sessions
 */
class SessionRecovery {
  /**
   * Find inactive sessions for a user
   * 
   * @param {string} username - Username to find sessions for
   * @param {number} thresholdMinutes - Time in minutes to consider a session inactive
   * @param {number} limit - Maximum number of sessions to return
   * @returns {Promise<Array>} - Array of inactive sessions
   */
  static async findInactiveSessions(username, thresholdMinutes = 30, limit = 5) {
    try {
      const SessionHistory = mongoose.model('SessionHistory');
      const thresholdTime = new Date(Date.now() - (thresholdMinutes * 60 * 1000));
      
      return SessionHistory.find({
        username,
        'metadata.lastActivity': { $lt: thresholdTime },
        'metadata.recovered': { $ne: true }
      })
      .sort({ 'metadata.lastActivity': -1 })
      .limit(limit);
    } catch (error) {
      logger.error(`Error finding inactive sessions: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Mark a session as recovered
   * 
   * @param {string} sessionId - ID of the session to mark
   * @param {string} socketId - New socket ID to associate with the session
   * @returns {Promise<boolean>} - True if the session was marked successfully
   */
  static async markSessionRecovered(sessionId, socketId) {
    try {
      const SessionHistory = mongoose.model('SessionHistory');
      
      const result = await SessionHistory.findByIdAndUpdate(
        sessionId, 
        { 
          $set: {
            'metadata.recovered': true,
            'metadata.lastActivity': new Date(),
            socketId
          }
        },
        { new: true }
      );
      
      if (result) {
        logger.info(`Session ${sessionId} marked as recovered for socket ${socketId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error marking session as recovered: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Clean up old abandoned sessions
   * 
   * @param {number} maxAgeDays - Maximum age in days to keep inactive sessions
   * @returns {Promise<number>} - Number of sessions cleaned up
   */
  static async cleanupOldSessions(maxAgeDays = 30) {
    try {
      const SessionHistory = mongoose.model('SessionHistory');
      const maxAgeDate = new Date(Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000));
      
      const result = await SessionHistory.deleteMany({
        'metadata.lastActivity': { $lt: maxAgeDate }
      });
      
      logger.info(`Cleaned up ${result.deletedCount} old sessions older than ${maxAgeDays} days`);
      return result.deletedCount;
    } catch (error) {
      logger.error(`Error cleaning up old sessions: ${error.message}`);
      return 0;
    }
  }
}

export default SessionRecovery;
