import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { BaseWorker } from './baseWorker.js';
import { parentPort } from 'worker_threads';
import Logger from '../../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import connectToMongoDB from '../../utils/dbConnection.js';
import workerGracefulShutdown, { setupWorkerShutdownHandlers } from '../../utils/gracefulShutdown.js';

// Initialize logger
const logger = new Logger('TextScraper');

export class DataProcessingWorker extends BaseWorker {
  constructor() {
    super('DataProcessor');
  }
  
  // Worker-specific methods
  processData(data) {
    this.logger.info('Processing data');
    // Data processing logic
  }
}

dotenv.config();

// MongoDB Schema for BambiSleep content - now focused on text/documents
const ContentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'document'],
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  title: String,
  content: String,
  url: String,
  source: String,
  metadata: {
    keywords: [String],
    description: String,
    categories: [String],
    created: Date
  },
  filePath: String,
  mediaType: {
    type: String,
    enum: [
      // Document types
      'pdf', 'doc', 'docx', 'txt', 'md', 'html', 'css', 'js', 'py', 'php',
      'unknown'
    ]
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
    logger.success('Text scraper connected to MongoDB');
    return mongoose.model('BambiContent', ContentSchema);
  } catch (error) {
    logger.error('Text scraper MongoDB setup error:', error.message);
    throw error;
  }
};

// Parse content based on file type
const parseContent = async (filePath, fileType) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    let parsedContent = { raw: content, extracted: '' };
    
    switch (fileType) {
      case 'md':
      case 'txt':
        parsedContent.extracted = content;
        break;
      case 'html':
        const $ = cheerio.load(content);
        parsedContent.extracted = $('body').text();
        break;
      case 'js':
      case 'py':
      case 'php':
      case 'css':
        // Extract comments and string literals as they may contain relevant text
        parsedContent.extracted = content.match(/\/\/.*|\/\*[\s\S]*?\*\/|#.*|"""[\s\S]*?"""|'''[\s\S]*?'''|".*?"|'.*?'/g)?.join(' ') || '';
        break;
      default:
        parsedContent.extracted = content;
    }
    
    return parsedContent;
  } catch (error) {
    logger.error(`Error parsing ${fileType} content:`, error.message);
    return { raw: '', extracted: '' };
  }
};

// Web scraper function - now focused on text only
const scrapeWebContent = async (url, ContentModel) => {
  try {
    logger.info(`Scraping ${url} for bambisleep text content`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      }
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    const pageText = $('body').text();
    
    // Check if the page contains bambisleep-related content
    if (pageText.toLowerCase().includes('bambisleep') || pageText.toLowerCase().includes('bambi sleep')) {
      // Extract page metadata
      const title = $('title').text();
      const description = $('meta[name="description"]').attr('content') || '';
      const keywords = $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim()) || [];
      
      // Store text content
      const textContent = new ContentModel({
        type: 'text',
        fileType: 'html',
        title: title,
        content: pageText,
        url: url,
        source: 'web',
        metadata: {
          keywords: keywords,
          description: description,
          categories: ['web'],
          created: new Date()
        },
        mediaType: 'html'
      });
      
      await textContent.save();
      logger.success(`Saved bambisleep text content from ${url}`);
      
      return {
        success: true,
        message: `Found and stored bambisleep text content from ${url}`,
        contentFound: true
      };
    } else {
      return {
        success: true,
        message: `No bambisleep content found at ${url}`,
        contentFound: false
      };
    }
  } catch (error) {
    logger.error(`Error scraping ${url}:`, error.message);
    return {
      success: false,
      message: `Error scraping ${url}: ${error.message}`,
      contentFound: false
    };
  }
};

// Directory scanner to find local text/document files
const scanDirectory = async (dirPath, ContentModel) => {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    const results = [];
    
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      
      if (file.isDirectory()) {
        // Recursively scan subdirectories
        const subResults = await scanDirectory(filePath, ContentModel);
        results.push(...subResults);
      } else {
        // Process file
        const extension = path.extname(file.name).substring(1).toLowerCase();
        
        // Check if it's a file type we can parse (text/document only)
        if (['md', 'txt', 'html', 'css', 'js', 'py', 'php', 'pdf', 'doc', 'docx'].includes(extension)) {
          const parsedContent = await parseContent(filePath, extension);
          
          // Check if content contains bambisleep references
          if (parsedContent.extracted.toLowerCase().includes('bambisleep') || 
              parsedContent.extracted.toLowerCase().includes('bambi sleep')) {
            const textContent = new ContentModel({
              type: 'text',
              fileType: extension,
              title: path.basename(file.name),
              content: parsedContent.extracted,
              filePath: filePath,
              source: 'local',
              metadata: {
                keywords: [],
                description: '',
                categories: ['local'],
                created: new Date()
              },
              mediaType: extension
            });
            await textContent.save();
            results.push(textContent);
          }
        }
      }
    }
    
    return results;
  } catch (error) {
    logger.error(`Error scanning directory ${dirPath}:`, error.message);
    return [];
  }
};

// Main function to handle worker messages
let ContentModel;
let isInitialized = false;

setupWorkerShutdownHandlers('TextScraper');

parentPort.on('message', async (msg) => {
  try {
    // Initialize MongoDB connection if not already done
    if (!isInitialized) {
      ContentModel = await setupMongoDB();
      isInitialized = true;
    }
    
    switch (msg.type) {
      case 'scrape_url':
        const urlResult = await scrapeWebContent(msg.url, ContentModel);
        parentPort.postMessage({
          type: 'scrape_result',
          data: urlResult,
          requestId: msg.requestId
        });
        break;
        
      case 'scan_directory':
        const dirResult = await scanDirectory(msg.directory, ContentModel);
        parentPort.postMessage({
          type: 'scan_result',
          data: dirResult,
          requestId: msg.requestId
        });
        break;
        
      case 'search_content':
        // Search for text/document content in the database
        const query = new RegExp(msg.query, 'i');
        const searchResults = await ContentModel.find({
          type: { $in: ['text', 'document'] },
          $or: [
            { content: query },
            { title: query },
            { 'metadata.description': query },
            { 'metadata.keywords': query }
          ]
        }).limit(20);
        
        parentPort.postMessage({
          type: 'search_result',
          data: searchResults,
          requestId: msg.requestId
        });
        break;
        
      case 'shutdown':
        logger.info('Received shutdown command from parent');
        await workerGracefulShutdown('TextScraper');
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

logger.info('GoodScraping worker started and ready to receive messages');