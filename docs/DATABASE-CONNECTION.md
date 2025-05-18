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
