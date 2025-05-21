const mongoose = require('mongoose');
require('dotenv').config();

// Connection URIs from the .env file
const mainDbUri = process.env.MONGODB_URI;
const profilesDbUri = process.env.MONGODB_PROFILES;

// Helper function to extract database name from MongoDB URI
function extractDatabaseName(uri) {
  if (!uri) return null;
  
  try {
    // Match pattern for standard and srv connection strings
    const matches = uri.match(/\/([^/?]+)(\?|$)/);
    
    // Special case for MongoDB Atlas style connections
    if (!matches && uri.includes('mongodb+srv://')) {
      // For Atlas connections in format mongodb+srv://user:pass@cluster.mongodb.net/dbname
      const atlasMatches = uri.match(/mongodb\+srv:\/\/[^/]+\/([^/?]+)/);
      return atlasMatches && atlasMatches[1] ? atlasMatches[1] : null;
    }
    
    return matches && matches[1] ? matches[1] : null;
  } catch (error) {
    return null;
  }
}

// Function to test a MongoDB connection
async function testConnection(uri, name) {
  console.log(`Testing connection to ${name}...`);
  
  try {
    // Extract database name from URI before connecting
    const dbName = extractDatabaseName(uri);
    
    // If no database was specified in the URI, we can add a default one for testing
    const connectionOptions = {
      connectTimeoutMS: 5000,  // 5 seconds timeout
      serverSelectionTimeoutMS: 5000  // 5 seconds timeout for server selection
    };
    
    const connection = await mongoose.createConnection(uri, connectionOptions);
    console.log(`✅ Successfully connected to ${name}`);
    console.log(`   Database name: ${dbName || 'Not specified in connection string'}`);

    // Get connection info
    try {
      console.log(`   Host: ${connection.host || connection.client?.topology?.s?.options?.hosts?.[0] || 'Not available'}`);
      console.log(`   Port: ${connection.port || '27017 (default)'}`);
    } catch (error) {
      console.log(`   Host/Port: Not available (${error.message})`);
    }
    
    // Simple connection check without trying to list collections
    console.log(`   Connection status: ${connection.readyState === 1 ? 'Ready' : 'Not ready'}`);
    
    try {
      await connection.close();
      console.log(`   Connection closed successfully`);
    } catch (closeError) {
      console.log(`   Note: ${closeError.message}`);
    }
    return true;
  } catch (error) {
    console.error(`❌ Failed to connect to ${name}`);
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

// Main function to test both connections
async function testBothConnections() {
  console.log('MongoDB Connection Test');
  console.log('======================\n');
  
  console.log('Connection Strings:');
  console.log(`   MONGODB_URI: ${mainDbUri ? (mainDbUri.substring(0, 20) + '...') : 'Not set'}`);
  console.log(`   MONGODB_PROFILES: ${profilesDbUri ? (profilesDbUri.substring(0, 20) + '...') : 'Not set'}`);
  console.log('');
  
  try {
    const mainResult = await testConnection(mainDbUri, 'Main Database (MONGODB_URI)');
    console.log('');
    
    const profilesResult = await testConnection(profilesDbUri, 'Profiles Database (MONGODB_PROFILES)');
    console.log('');
    
    if (mainResult && profilesResult) {
      console.log('✅ All database connections successful!');
    } else {
      console.log('❌ Some database connections failed. Check the errors above.');
    }
  } catch (error) {
    console.error('❌ Unexpected error during connection tests:', error.message);
  }
}

// Run the tests
testBothConnections()
  .catch(err => {
    console.error('Unexpected error during testing:', err);
  })
  .finally(() => {
    // Exit the process when done
    setTimeout(() => process.exit(), 1000);
  });
