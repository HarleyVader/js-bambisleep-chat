import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { parentPort } from 'worker_threads';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as cheerio from 'cheerio';

dotenv.config();

// MongoDB Schema for BambiSleep image content
const ImageContentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['image'],
    required: true
  },
  url: String,
  source: String,
  metadata: {
    keywords: [String],
    description: String,
    categories: [String],
    created: Date
  },
  filePath: String,
  dateAdded: {
    type: Date,
    default: Date.now
  }
});

// Set up MongoDB connection
const setupMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep');
    console.log('MongoDB connected successfully');
    return mongoose.model('BambiImageContent', ImageContentSchema);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
};

// Scrape image content from a web page
const scrapeImageContent = async (url, ImageContentModel) => {
  try {
    console.log(`Scraping ${url} for BambiSleep image content`);
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    
    const images = [];
    $('img').each((index, element) => {
      const imgUrl = $(element).attr('src');
      if (imgUrl) {
        images.push(imgUrl);
      }
    });

    for (const imgUrl of images) {
      const imageContent = new ImageContentModel({
        type: 'image',
        url: imgUrl,
        source: url,
        metadata: {
          keywords: [],
          description: '',
          categories: ['web'],
          created: new Date()
        }
      });
      await imageContent.save();
      console.log(`Saved image content from ${imgUrl}`);
    }

    return {
      success: true,
      message: `Found and stored image content from ${url}`,
      contentFound: images.length > 0
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return {
      success: false,
      message: `Error scraping ${url}: ${error.message}`,
      contentFound: false
    };
  }
};

// Main function to handle worker messages
let ImageContentModel;
let isInitialized = false;

parentPort.on('message', async (msg) => {
  try {
    // Initialize MongoDB connection if not already done
    if (!isInitialized) {
      ImageContentModel = await setupMongoDB();
      isInitialized = true;
    }
    
    switch (msg.type) {
      case 'scrape_images':
        const imageResult = await scrapeImageContent(msg.url, ImageContentModel);
        parentPort.postMessage({
          type: 'scrape_result',
          data: imageResult,
          requestId: msg.requestId
        });
        break;
        
      case 'shutdown':
        console.log('Shutting down image scraping worker...');
        await mongoose.connection.close();
        process.exit(0);
        break;
        
      default:
        console.warn(`Unknown message type: ${msg.type}`);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    parentPort.postMessage({
      type: 'error',
      data: error.message,
      requestId: msg.requestId
    });
  }
});

console.log('Image scraping worker started and ready to receive messages');