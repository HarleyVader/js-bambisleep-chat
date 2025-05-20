/**
 * Database Status Notifier
 * Provides notifications to users about database status
 */

import { inFallbackMode, hasConnection } from '../config/db.js';
import Logger from './logger.js';

const logger = new Logger('DbStatusNotifier');

/**
 * Send database status notification to a socket
 * 
 * @param {Object} socket - Socket.io socket
 */
export function notifyDbStatus(socket) {
  try {
    const isConnected = hasConnection();
    const fallbackMode = inFallbackMode();
    
    if (!isConnected) {
      socket.emit('db:status', {
        status: 'disconnected',
        message: 'Database connection unavailable. Some features will not work properly.'
      });
      return;
    }
    
    if (fallbackMode) {
      socket.emit('db:status', {
        status: 'fallback',
        message: 'Running in database fallback mode. Some features may be limited.'
      });
      return;
    }
    
    // Everything is fine, send normal status
    socket.emit('db:status', {
      status: 'connected'
    });
  } catch (error) {
    logger.error(`Error sending database status: ${error.message}`);
  }
}

/**
 * Broadcast database status to all connected clients
 * 
 * @param {Object} io - Socket.io server instance
 */
export function broadcastDbStatus(io) {
  try {
    const isConnected = hasConnection();
    const fallbackMode = inFallbackMode();
    
    let status = 'connected';
    let message = null;
    
    if (!isConnected) {
      status = 'disconnected';
      message = 'Database connection unavailable. Some features will not work properly.';
    } else if (fallbackMode) {
      status = 'fallback';
      message = 'Running in database fallback mode. Some features may be limited.';
    }
    
    io.emit('db:status', { status, message });
    
    logger.debug(`Broadcast database status: ${status}`);
  } catch (error) {
    logger.error(`Error broadcasting database status: ${error.message}`);
  }
}

export default {
  notifyDbStatus,
  broadcastDbStatus
};
