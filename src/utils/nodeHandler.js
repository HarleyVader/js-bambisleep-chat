import mongoose from 'mongoose';
import { UserProfile } from '../models/user.js';
import Logger from './logger.js';

// Initialize logger
const logger = new Logger('NodeHandler');

// Stats model
const ConnectionStats = mongoose.model('ConnectionStats', new mongoose.Schema({
  userId: String,
  socketId: String,
  actionType: String, // 'connect' or 'disconnect'
  timestamp: Date
}));

// Database operations stats
const DbOperationStats = mongoose.model('DbOperationStats', new mongoose.Schema({
  operation: String, // 'create', 'update', 'delete', 'read' 
  collection: String,
  duration: Number, // in milliseconds
  success: Boolean,
  timestamp: Date,
  executedBy: String
}));

// Health check records
const HealthCheckLog = mongoose.model('HealthCheckLog', new mongoose.Schema({
  status: String, // 'healthy', 'degraded', 'unhealthy'
  responseTime: Number,
  details: Object,
  timestamp: Date
}));

// Create NodeHandler factory
const createNodeHandler = () => {
  const stats = {
    operations: {
      total: 0,
      create: 0,
      read: 0,
      update: 0,
      delete: 0,
      failures: 0
    },
    connections: {
      total: 0,
      current: 0
    },
    health: {
      lastCheck: null,
      status: 'unknown',
      history: []
    }
  };

  // Track operation timing and stats
  const trackOperation = async (operation, collection, userId, startTime, success = true) => {
    try {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Update local stats
      stats.operations.total++;
      if (success) {
        stats.operations[operation]++;
      } else {
        stats.operations.failures++;
      }

      // Save to database
      await DbOperationStats.create({
        operation,
        collection,
        duration,
        success,
        timestamp: new Date(),
        executedBy: userId || 'system'
      });
    } catch (error) {
      logger.error('Error tracking operation stats:', error);
    }
  };

  return {
    // User profile operations
    async updateUserProfile(userId, updateData) {
      const startTime = Date.now();
      try {
        const profile = await UserProfile.findOneAndUpdate(
          { userId },
          { $set: updateData },
          { new: true }
        );
        
        await trackOperation('update', 'UserProfile', userId, startTime);
        return profile;
      } catch (error) {
        await trackOperation('update', 'UserProfile', userId, startTime, false);
        logger.error('Update user profile error:', error);
        throw error;
      }
    },

    // Friend operations
    async addFriend(userId, friendId) {
      const startTime = Date.now();
      try {
        // Update current user's friends list
        await UserProfile.findOneAndUpdate(
          { userId },
          { $addToSet: { friends: friendId } }
        );
        
        // Update friend's friends list
        await UserProfile.findOneAndUpdate(
          { userId: friendId },
          { $addToSet: { friends: userId } }
        );
        
        await trackOperation('update', 'UserProfile', userId, startTime);
        return true;
      } catch (error) {
        await trackOperation('update', 'UserProfile', userId, startTime, false);
        logger.error('Add friend error:', error);
        throw error;
      }
    },

    async removeFriend(userId, friendId) {
      const startTime = Date.now();
      try {
        // Update current user's friends list
        await UserProfile.findOneAndUpdate(
          { userId },
          { $pull: { friends: friendId } }
        );
        
        // Update friend's friends list
        await UserProfile.findOneAndUpdate(
          { userId: friendId },
          { $pull: { friends: userId } }
        );
        
        await trackOperation('update', 'UserProfile', userId, startTime);
        return true;
      } catch (error) {
        await trackOperation('update', 'UserProfile', userId, startTime, false);
        logger.error('Remove friend error:', error);
        throw error;
      }
    },

    // Generic database operations
    async performOperation(operation, collection, query, update, options) {
      const startTime = Date.now();
      try {
        if (!mongoose.models[collection]) {
          throw new Error(`Collection ${collection} not found`);
        }
        
        const Model = mongoose.model(collection);
        let result;
        
        switch (operation) {
          case 'create':
            result = await Model.create(query);
            await trackOperation('create', collection, options?.userId, startTime);
            break;
          case 'findOne':
            result = await Model.findOne(query);
            await trackOperation('read', collection, options?.userId, startTime);
            break;
          case 'find':
            result = await Model.find(query);
            await trackOperation('read', collection, options?.userId, startTime);
            break;
          case 'update':
            result = await Model.updateOne(query, update, options);
            await trackOperation('update', collection, options?.userId, startTime);
            break;
          case 'delete':
            result = await Model.deleteOne(query);
            await trackOperation('delete', collection, options?.userId, startTime);
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
        
        return result;
      } catch (error) {
        await trackOperation(operation, collection, options?.userId, startTime, false);
        logger.error(`Database operation error (${operation} on ${collection}):`, error);
        throw error;
      }
    },

    // Health check
    async checkHealth() {
      const startTime = Date.now();
      try {
        // Check MongoDB connection
        const adminDb = mongoose.connection.db.admin();
        const serverStatus = await adminDb.serverStatus();
        
        // Check for indexes that might be missing
        const collections = await mongoose.connection.db.listCollections().toArray();
        
        // Perform simple query to test read operation
        const testQuery = await UserProfile.findOne().select('_id').lean();
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        const status = {
          status: 'healthy',
          responseTime,
          mongodb: {
            connected: mongoose.connection.readyState === 1,
            version: serverStatus.version,
            uptime: serverStatus.uptime,
            connections: serverStatus.connections
          },
          collections: collections.length,
          timestamp: new Date()
        };
        
        // Update local stats
        stats.health.lastCheck = new Date();
        stats.health.status = status.status;
        stats.health.history.push({
          timestamp: new Date(),
          status: status.status,
          responseTime
        });
        
        // Keep only last 10 history entries
        if (stats.health.history.length > 10) {
          stats.health.history.shift();
        }
        
        // Record health check
        await HealthCheckLog.create({
          status: status.status,
          responseTime,
          details: status,
          timestamp: new Date()
        });
        
        return status;
      } catch (error) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        const status = {
          status: 'unhealthy',
          responseTime,
          error: error.message,
          timestamp: new Date()
        };
        
        // Update local stats
        stats.health.lastCheck = new Date();
        stats.health.status = status.status;
        stats.health.history.push({
          timestamp: new Date(),
          status: status.status,
          responseTime,
          error: error.message
        });
        
        // Keep only last 10 history entries
        if (stats.health.history.length > 10) {
          stats.health.history.shift();
        }
        
        // Record health check
        await HealthCheckLog.create({
          status: status.status,
          responseTime,
          details: status,
          timestamp: new Date()
        });
        
        logger.error('Health check error:', error);
        return status;
      }
    },

    // Connection tracking
    async logConnection(data) {
      try {
        await ConnectionStats.create({
          userId: data.userId,
          socketId: data.socketId,
          actionType: 'connect',
          timestamp: data.timestamp || new Date()
        });
        
        // Update local stats
        stats.connections.total++;
        stats.connections.current++;
      } catch (error) {
        logger.error('Error logging connection:', error);
      }
    },

    async logDisconnection(data) {
      try {
        await ConnectionStats.create({
          userId: data.userId,
          socketId: data.socketId,
          actionType: 'disconnect',
          timestamp: data.timestamp || new Date()
        });
        
        // Update local stats
        stats.connections.current = Math.max(0, stats.connections.current - 1);
      } catch (error) {
        logger.error('Error logging disconnection:', error);
      }
    },

    // Stats retrieval
    async getStats() {
      try {
        // Get additional stats from database
        const lastDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const [
          dbOperationsToday,
          connectionsToday,
          uniqueUsersToday,
          healthHistory
        ] = await Promise.all([
          DbOperationStats.countDocuments({ timestamp: { $gte: lastDay } }),
          ConnectionStats.countDocuments({ timestamp: { $gte: lastDay }, actionType: 'connect' }),
          ConnectionStats.distinct('userId', { timestamp: { $gte: lastDay } }),
          HealthCheckLog.find().sort({ timestamp: -1 }).limit(5)
        ]);
        
        return {
          ...stats,
          daily: {
            operations: dbOperationsToday,
            connections: connectionsToday,
            uniqueUsers: uniqueUsersToday.length
          },
          health: {
            ...stats.health,
            recentChecks: healthHistory
          },
          timestamp: new Date()
        };
      } catch (error) {
        logger.error('Error getting stats:', error);
        return stats;
      }
    }
  };
};

export { createNodeHandler };