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

  /**
   * Check for abandoned sessions for a user and recover them
   * 
   * @param {Socket} socket - The client socket
   * @param {string} username - The username
   * @returns {Promise<boolean>} - True if a session was recovered
   */
  static async checkForAbandonedSessions(socket, username) {
    if (!socket || !username || username === 'anonBambi') {
      return false;
    }

    try {
      // Find session histories for this user that aren't closed but are disconnected
      const SessionHistory = mongoose.model('SessionHistory');
      const abandonedSessions = await SessionHistory.find({
        username,
        'metadata.status': { $ne: 'closed' },
        'metadata.disconnectedAt': { $exists: true },
        'metadata.reconnectedAt': { $exists: false }
      }).sort({ 'metadata.lastActivity': -1 }).limit(1);

      if (abandonedSessions.length === 0) {
        return false;
      }

      const sessionToRecover = abandonedSessions[0];
      logger.info(`Found abandoned session for ${username}: ${sessionToRecover._id}`);

      // Set session as recovered
      sessionToRecover.metadata.reconnectedAt = new Date();
      sessionToRecover.metadata.status = 'active';
      sessionToRecover.metadata.recovered = true;
      sessionToRecover.socketId = socket.id;
      await sessionToRecover.save();

      // Assign the session to the new socket
      socket.activeSessionId = sessionToRecover._id.toString();

      // Need to emit session loaded event
      socket.emit('session-loaded', {
        session: sessionToRecover,
        sessionId: sessionToRecover._id,
        recovered: true
      });

      logger.info(`Recovered session ${sessionToRecover._id} for ${username}`);

      // Also send a notification to the user
      socket.emit('notification', {
        type: 'info',
        message: 'Your previous session has been restored.'
      });
      
      return true;
    } catch (error) {
      logger.error(`Error checking for abandoned sessions: ${error.message}`);
      return false;
    }
  }

  /**
   * Mark a session as disconnected when the user disconnects
   * 
   * @param {string} socketId - The socket ID
   * @param {string} sessionId - The session ID
   * @returns {Promise<boolean>} - True if the session was marked successfully
   */
  static async markSessionAsDisconnected(socketId, sessionId) {
    if (!sessionId) {
      return false;
    }

    try {
      const SessionHistory = mongoose.model('SessionHistory');
      const session = await SessionHistory.findById(sessionId);

      if (!session) {
        return false;
      }

      // Update session metadata
      if (!session.metadata) {
        session.metadata = {};
      }
      
      session.metadata.disconnectedAt = new Date();
      session.metadata.status = 'disconnected';
      
      await session.save();
      logger.info(`Marked session ${sessionId} as disconnected`);
      return true;
    } catch (error) {
      logger.error(`Error marking session as disconnected: ${error.message}`);
      return false;
    }
  }
}

export default SessionRecovery;
