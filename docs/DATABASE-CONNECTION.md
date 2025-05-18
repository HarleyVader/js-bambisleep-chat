# Database Connection Architecture

## Overview

The BambiSleep Chat application uses MongoDB for data persistence. The database connection architecture is designed to be robust, with connection pooling, automatic reconnection, and monitoring capabilities.

## Key Files

### 1. `src/config/db.js`

This is the primary connection module that handles:
- Establishing MongoDB connections with proper options
- Connection pooling configuration
- Error handling and reconnection logic
- Fallback to local database if primary is unavailable
- Prevention and recovery from connection pool issues

### 2. `src/utils/dbConnection.js`

A thin wrapper around `db.js` that:
- Provides a simplified interface for worker threads
- Used primarily by scraper workers
- Maintains backward compatibility with existing code

### 3. `src/utils/connectionMonitor.js`

Real-time monitoring of MongoDB connections:
- Tracks connection status and reports issues
- Alerts on high connection usage
- Monitors connection pool health
- Used by the main server process for ongoing monitoring

### 4. `src/utils/dbHealthMonitor.js`

Periodic health checks of the database connection:
- Runs checks every 30 seconds
- Detects unhealthy connections
- Triggers reconnection when issues are detected
- Prevents reconnection storms with rate limiting

### 5. `src/utils/connectionPoolMonitor.js`

Specialized monitoring of MongoDB connection pools:
- Tracks connection pool statistics
- Monitors available vs. total connections
- Detects stuck pending connections
- Forces pool refresh when issues are detected
- Performs scheduled pool refreshes every 4 hours

## Usage Guidelines

1. **For new server-side code**: Import and use `connectDB` from `src/config/db.js` directly:
   ```javascript
   import { connectDB } from '../config/db.js';
   
   // Use in async function
   const connected = await connectDB();
   ```

2. **For worker threads**: Import and use `connectToMongoDB` from `src/utils/dbConnection.js`:
   ```javascript
   import connectToMongoDB from '../utils/dbConnection.js';
   
   // Use in async function
   const connection = await connectToMongoDB();
   ```

3. **For connection monitoring**: Import from `src/utils/connectionMonitor.js`:
   ```javascript
   import { startConnectionMonitoring } from '../utils/connectionMonitor.js';
   
   // Start monitoring with 5-minute interval
   startConnectionMonitoring(300000);
   ```

## Connection Options

The default connection options (from `db.js`) are optimized for production use with reasonable timeouts and pool sizes. See the file for specific configuration details.

## Common Connection Issues and Solutions

### "Attempted to check out a connection from closed connection pool"

This error occurs when the MongoDB driver tries to use connections from a pool that has been closed.

**Causes:**
- Long periods of inactivity causing idle connection timeout
- Network interruptions between application and MongoDB
- MongoDB server restarts or maintenance
- High traffic spikes exceeding connection pool limits

**Solutions:**
1. The application implements automatic detection and recovery:
   - Connection pool monitoring detects closed pools
   - Automatic reconnection with retry logic
   - Fallback profile responses during connection issues
   
2. If errors persist in logs, try:
   - Restart the application in a controlled manner
   - Check MongoDB server status and logs
   - Verify network connectivity between app and database
   - Adjust connection pool settings if needed

### Connection Timeouts

**Causes:**
- High latency between application and MongoDB
- MongoDB under heavy load
- Insufficient resources on database server

**Solutions:**
1. Check MongoDB server performance metrics
2. Increase timeout settings in `db.js` if needed
3. Consider scaling MongoDB resources
4. Review database query patterns for optimization
