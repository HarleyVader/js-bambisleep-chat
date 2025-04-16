import axios from 'axios';
import { parentPort } from 'worker_threads';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
import { BaseWorker } from './baseWorker.js';
import Logger from '../../utils/logger.js';
import connectToMongoDB from '../../utils/dbConnection.js';
import gracefulShutdown, { handleWorkerShutdown, setupWorkerShutdownHandlers } from '../../utils/gracefulShutdown.js';
import { withDbConnection } from '../../config/db.js';

dotenv.config();

// Initialize logger
const logger = new Logger('ImageScraper');

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

// Scrape image content from a web page
const scrapeImageContent = async (url, saveImageData) => {
  try {
    logger.info(`Scraping ${url} for BambiSleep image content`);
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    
    const images = [];
    $('img').each((index, element) => {
      const imgUrl = $(element).attr('src');
      const alt = $(element).attr('alt') || '';
      const caption = $(element).attr('title') || '';
      
      if (imgUrl) {
        images.push({
          url: imgUrl,
          alt: alt,
          caption: caption
        });
      }
    });

    const savedImages = [];
    for (const img of images) {
      const imageData = {
        type: 'image',
        url: img.url,
        source: url,
        metadata: {
          keywords: [],
          description: img.alt || img.caption || '',
          categories: ['web'],
          created: new Date()
        }
      };
      const savedImage = await saveImageData(imageData);
      savedImages.push(savedImage);
      logger.success(`Saved image content from ${img.url}`);
    }

    return {
      success: true,
      message: `Found and stored image content from ${url}`,
      contentFound: images.length > 0,
      content: savedImages // Return the properly serializable array
    };
  } catch (error) {
    logger.error(`Error scraping ${url}:`, error.message);
    return {
      success: false,
      message: `Error scraping ${url}: ${error.message}`,
      contentFound: false,
      content: [] // Always return an array even on error
    };
  }
};

// Main function to handle worker messages
let isInitialized = false;

// Set up shutdown handlers
setupWorkerShutdownHandlers('ImageScraper');

parentPort.on('message', async (msg) => {
  try {
    // Initialize MongoDB connection if not already done
    if (!isInitialized) {
      await connectToMongoDB();
      isInitialized = true;
    }
    
    switch (msg.type) {
      case 'scrape_images':
        const imageScraperWorker = new ImageScraperWorker();
        const imageResult = await scrapeImageContent(msg.url, imageScraperWorker.saveImageData.bind(imageScraperWorker));
        // Ensure we're sending serializable data
        parentPort.postMessage({
          type: 'scrape_result',
          data: JSON.parse(JSON.stringify(imageResult)), // Ensure proper serialization
          requestId: msg.requestId
        });
        break;
        
      case 'shutdown':
        logger.info('Received shutdown command from parent');
        await handleWorkerShutdown('ImageScraper');
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

logger.info('Image scraping worker started and ready to receive messages');

export class ImageScraperWorker extends BaseWorker {
  constructor() {
    super('ImageScraper');
  }
  
  async saveImageData(imageData) {
    return withDbConnection(async () => {
      const ImageContent = mongoose.model('ImageContent', ImageContentSchema);
      return await ImageContent.create(imageData);
    });
  }
}