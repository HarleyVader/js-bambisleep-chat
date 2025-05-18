// Basic MongoDB connection and operations test
import mongoose from 'mongoose';
import { connectDB, disconnectDB, withDbConnection } from '../config/db.js';
import Logger from '../utils/logger.js';
import { runDBChecks } from '../utils/db-check.js';

const logger = new Logger('MongoDBTest');

// Sample schema for testing
const TestModelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  value: {
    type: String,
    default: 'test-value'
  },
  testDate: {
    type: Date,
    default: Date.now
  }
});

// Get the test model (or create it if it doesn't exist)
function getTestModel() {
  try {
    return mongoose.model('TestModel');
  } catch (error) {
    return mongoose.model('TestModel', TestModelSchema);
  }
}

// Test basic CRUD operations
async function testCRUDOperations() {
  logger.info('Running CRUD operation tests...');
  
  try {
    const TestModel = getTestModel();
    const testName = `test-${Date.now()}`;
    
    // Test 1: Create
    logger.info('Test 1: Create document');
    const created = await TestModel.create({
      name: testName,
      value: `test-value-${Date.now()}`
    });
    
    if (!created || !created._id) {
      throw new Error('Failed to create test document');
    }
    logger.success('✓ Create test passed');
    
    // Test 2: Read
    logger.info('Test 2: Read document');
    const found = await TestModel.findById(created._id);
    
    if (!found || found.name !== testName) {
      throw new Error('Failed to read test document');
    }
    logger.success('✓ Read test passed');
    
    // Test 3: Update
    logger.info('Test 3: Update document');
    const updatedValue = `updated-${Date.now()}`;
    const updated = await TestModel.findByIdAndUpdate(
      created._id,
      { value: updatedValue },
      { new: true }
    );
    
    if (!updated || updated.value !== updatedValue) {
      throw new Error('Failed to update test document');
    }
    logger.success('✓ Update test passed');
    
    // Test 4: Delete
    logger.info('Test 4: Delete document');
    const deleted = await TestModel.findByIdAndDelete(created._id);
    
    if (!deleted) {
      throw new Error('Failed to delete test document');
    }
    
    // Verify deletion
    const shouldBeNull = await TestModel.findById(created._id);
    if (shouldBeNull) {
      throw new Error('Document still exists after delete');
    }
    logger.success('✓ Delete test passed');
    
    return true;
  } catch (error) {
    logger.error(`CRUD test failed: ${error.message}`);
    return false;
  }
}

// Test transaction support
async function testTransactions() {
  logger.info('Testing transaction support...');
  
  try {
    // Check if transactions are supported
    const session = await mongoose.startSession();
    session.startTransaction();
    await session.commitTransaction();
    await session.endSession();
    
    logger.success('✓ Transactions are supported');
    return true;
  } catch (error) {
    logger.warning(`Transactions not supported: ${error.message}`);
    logger.info('This is expected for standalone MongoDB servers or older versions');
    return false;
  }
}

// Test connection pooling
async function testConnectionPooling() {
  logger.info('Testing connection pooling...');
  
  try {
    // Run 5 parallel operations to test pool
    const operations = Array(5).fill().map((_, i) => 
      withDbConnection(async () => {
        // Small delay to ensure connections overlap
        await new Promise(resolve => setTimeout(resolve, 50 * i));
        return mongoose.connection.db.command({ ping: 1 });
      })
    );
    
    await Promise.all(operations);
    logger.success('✓ Connection pooling test passed');
    return true;
  } catch (error) {
    logger.error(`Connection pooling test failed: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  logger.info('Starting MongoDB tests...');
  
  try {
    // Step 1: Run the DB checks
    logger.info('Step 1: Running DB health checks...');
    const healthChecks = await runDBChecks();
    
    if (!healthChecks.mongooseConnection.connected) {
      throw new Error(`MongoDB connection failed: ${healthChecks.mongooseConnection.error || 'Unknown error'}`);
    }
    
    logger.success('✓ MongoDB health checks passed');
    
    // Step 2: Test CRUD operations
    logger.info('Step 2: Testing CRUD operations...');
    const crudSuccess = await testCRUDOperations();
    
    if (!crudSuccess) {
      throw new Error('CRUD operations test failed');
    }
    
    // Step 3: Test transactions (optional)
    logger.info('Step 3: Testing transaction support...');
    await testTransactions();
    
    // Step 4: Test connection pooling
    logger.info('Step 4: Testing connection pooling...');
    const poolingSuccess = await testConnectionPooling();
    
    if (!poolingSuccess) {
      throw new Error('Connection pooling test failed');
    }
    
    logger.success('All MongoDB tests completed successfully!');
    return true;
  } catch (error) {
    logger.error(`MongoDB tests failed: ${error.message}`);
    return false;
  } finally {
    // Cleanup - disconnect from MongoDB when done
    await disconnectDB();
  }
}

// Run tests if called directly
if (process.argv[1].endsWith('mongodbTest.js')) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Error running MongoDB tests:', error);
      process.exit(1);
    });
}

export default runAllTests;
