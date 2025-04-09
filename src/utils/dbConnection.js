import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Connects to MongoDB using connection string from environment variables
 * @returns {Promise} Connection promise
 */
async function connectToMongoDB() {
  try {
    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep';
    
    await mongoose.connect(MONGO_URI)
      .then(() => {
        console.log('Successfully connected to MongoDB');
      })
      .catch(err => {
        console.error('MongoDB connection error:', err);
      });
    
    return mongoose.connection;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

export default connectToMongoDB;