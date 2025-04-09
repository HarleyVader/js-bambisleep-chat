import dotenv from 'dotenv';
dotenv.config();

export default {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep'
  },
  app: {
    mainPort: process.env.SERVER_PORT || 6969,
    profilePort: process.env.PROFILES_PORT || 3001
  },
  paths: {
    profileMount: '/profiles'
  }
};