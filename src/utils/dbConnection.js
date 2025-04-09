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
    
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };
    
    await mongoose.connect(MONGO_URI, options);
    
    console.log('Successfully connected to MongoDB');
    
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    return mongoose.connection;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

export default connectToMongoDB;