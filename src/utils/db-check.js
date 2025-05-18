// Basic MongoDB connection checker utility
import mongoose from 'mongoose';
import { exec } from 'child_process';
import { promisify } from 'util';
import Logger from './logger.js';

const execAsync = promisify(exec);
const logger = new Logger('DBCheck');

// Check if mongod is running
export async function checkMongodStatus() {
  try {
    const { stdout } = await execAsync('ps aux | grep mongod | grep -v grep');
    return {
      running: stdout.trim().length > 0,
      processes: stdout.trim().split('\n').length
    };
  } catch (error) {
    return { running: false, processes: 0 };
  }
}

// Test direct MongoDB connection (without mongoose)
export async function testDirectConnection(uri = process.env.MONGODB_URI) {
  try {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(uri);
    await client.connect();
    const result = await client.db().admin().ping();
    await client.close();
    
    return {
      connected: true,
      pingResult: result,
      error: null
    };
  } catch (error) {
    return {
      connected: false,
      pingResult: null,
      error: error.message
    };
  }
}

// Test mongoose connection
export async function testMongooseConnection(uri = process.env.MONGODB_URI) {
  // Store current connection state to restore after test
  const prevConnection = mongoose.connection.readyState;
  
  try {
    // Only disconnect if already connected to a different database
    if (prevConnection === 1 && mongoose.connection.host !== uri) {
      await mongoose.disconnect();
    }
    
    // Connect with basic options and timeout
    await Promise.race([
      mongoose.connect(uri, { 
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
    ]);
    
    // Check connection
    const connected = mongoose.connection.readyState === 1;
    if (connected) {
      // Run a simple command to verify real connectivity
      await mongoose.connection.db.command({ ping: 1 });
    }

    return {
      connected,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      readyState: mongoose.connection.readyState
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      readyState: mongoose.connection.readyState
    };
  } finally {
    // Restore previous connection if needed
    if (prevConnection === 1 && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

// Check MongoDB server stats (requires admin access)
export async function getServerStats() {
  try {
    if (mongoose.connection.readyState !== 1) {
      return { error: 'Not connected to MongoDB' };
    }
    
    const stats = await mongoose.connection.db.admin().serverStatus();
    return {
      version: stats.version,
      uptime: stats.uptime,
      connections: stats.connections,
      memory: stats.mem,
      network: stats.network
    };
  } catch (error) {
    return { error: error.message };
  }
}

// Check if mongosh is available
export async function checkMongoshAvailability() {
  try {
    const { stdout, stderr } = await execAsync('mongosh --version');
    return {
      available: true,
      version: stdout.trim(),
      error: null
    };
  } catch (error) {
    return {
      available: false,
      version: null,
      error: error.message
    };
  }
}

// Run all checks and return results
export async function runDBChecks(uri = process.env.MONGODB_URI) {
  logger.info('Running MongoDB health checks...');
  
  const results = {
    timestamp: new Date().toISOString(),
    mongodStatus: await checkMongodStatus(),
    mongoshAvailable: await checkMongoshAvailability(),
    directConnection: await testDirectConnection(uri),
    mongooseConnection: await testMongooseConnection(uri),
    serverStats: null
  };
  
  // Only get server stats if connection succeeded
  if (results.directConnection.connected) {
    results.serverStats = await getServerStats();
  }
  
  return results;
}

// Run checks if called directly
if (process.argv[1].endsWith('db-check.js')) {
  runDBChecks()
    .then(results => {
      console.log(JSON.stringify(results, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Error running checks:', error);
      process.exit(1);
    });
}

export default runDBChecks;