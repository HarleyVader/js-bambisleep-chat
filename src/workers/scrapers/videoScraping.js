import axios from 'axios';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { parentPort } from 'worker_threads';
import Logger from '../../utils/logger.js';
import connectToMongoDB from '../../utils/dbConnection.js';
import workerGracefulShutdown, { setupWorkerShutdownHandlers } from '../../utils/gracefulShutdown.js';

// Initialize logger
const logger = new Logger('VideoScraper');

dotenv.config();

// MongoDB Schema for BambiSleep video content
const VideoContentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['video'],
    required: true
  },
  title: String,
  url: String,
  source: String,
  metadata: {
    description: String,
    keywords: [String],
    created: Date
  },
  dateAdded: {
    type: Date,
    default: Date.now
  }
});

// Set up MongoDB connection
const setupMongoDB = async () => {
  try {
    await connectToMongoDB();
    logger.success('Video scraper connected to MongoDB');
    return mongoose.model('BambiVideoContent', VideoContentSchema);
  } catch (error) {
    logger.error('Video scraper MongoDB setup error:', error.message);
    throw error;
  }
};

// Scrape video content from a given URL
const scrapeVideoContent = async (url, VideoContentModel) => {
  try {
    logger.info(`Scraping ${url} for BambiSleep video content`);
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract video metadata
    const title = $('title').text();
    const description = $('meta[name="description"]').attr('content') || '';
    const keywords = $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim()) || [];
    
    // Store video content
    const videoContent = new VideoContentModel({
      type: 'video',
      title: title,
      url: url,
      source: 'web',
      metadata: {
        description: description,
        keywords: keywords,
        created: new Date()
      }
    });
    
    await videoContent.save();
    logger.success(`Saved BambiSleep video content from ${url}`);
    
    return {
      success: true,
      message: `Found and stored BambiSleep video content from ${url}`,
      contentFound: true
    };
  } catch (error) {
    logger.error(`Error scraping ${url}:`, error.message);
    return {
      success: false,
      message: `Error scraping ${url}: ${error.message}`,
      contentFound: false
    };
  }
};

// Main function to handle worker messages
let VideoContentModel;
let isInitialized = false;

setupWorkerShutdownHandlers('VideoScraper');

parentPort.on('message', async (msg) => {
  try {
    // Initialize MongoDB connection if not already done
    if (!isInitialized) {
      VideoContentModel = await setupMongoDB();
      isInitialized = true;
    }
    
    switch (msg.type) {
      case 'scrape_videos':
        const urlResult = await scrapeVideoContent(msg.url, VideoContentModel);
        parentPort.postMessage({
          type: 'scrape_result',
          data: urlResult,
          requestId: msg.requestId
        });
        break;
        
      case 'shutdown':
        logger.info('Received shutdown command from parent');
        await workerGracefulShutdown('VideoScraper');
        break;
        
      default:
        logger.warning(`Unknown message type: ${msg.type}`);
    }
  } catch (error) {
    logger.error('Error handling message:', error);
    parentPort.postMessage({
      type: 'error',
      data: error.message,
      requestId: msg.requestId
    });
  }
});

logger.info('Video scraping worker started and ready to receive messages');