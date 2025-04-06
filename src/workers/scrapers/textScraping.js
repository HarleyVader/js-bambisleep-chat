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

function extractTextContent(htmlContent) {
  try {
    // Use cheerio to load the HTML
    const $ = cheerio.load(htmlContent);
    
    // Remove script tags, style tags, and other non-content elements
    const elementsToRemove = [
      'script', 'style', 'svg', 'iframe', 'noscript', 'meta', 'link'
    ];
    
    elementsToRemove.forEach(tag => {
      $(tag).remove();
    });
    
    // Find the main content container
    const mainContent = $('main').length ? $('main') : 
                       $('article').length ? $('article') : 
                       $('.content').length ? $('.content') : 
                       $('body');
    
    let markdownContent = '';
    
    // Process title
    const pageTitle = $('title').text().trim();
    if (pageTitle) {
      markdownContent += `# ${pageTitle}\n\n`;
    }
    
    // Process headings
    mainContent.find('h1, h2, h3, h4, h5, h6').each(function() {
      const tagName = $(this).prop('tagName').toLowerCase();
      const level = parseInt(tagName.replace('h', ''));
      const headingText = $(this).text().trim();
      
      if (headingText) {
        markdownContent += `${'#'.repeat(level)} ${headingText}\n\n`;
      }
    });
    
    // Process paragraphs
    mainContent.find('p').each(function() {
      const text = $(this).text().trim();
      if (text) {
        markdownContent += `${text}\n\n`;
      }
    });
    
    // Process lists
    mainContent.find('ul, ol').each(function() {
      const isOrdered = $(this).prop('tagName').toLowerCase() === 'ol';
      
      $(this).find('li').each(function(index) {
        const text = $(this).text().trim();
        if (text) {
          markdownContent += isOrdered ? `${index + 1}. ${text}\n` : `- ${text}\n`;
        }
      });
      
      markdownContent += '\n';
    });
    
    // Process links
    mainContent.find('a').each(function() {
      const text = $(this).text().trim();
      const href = $(this).attr('href');
      
      if (text && href && !markdownContent.includes(`[${text}](${href})`)) {
        // Replace plain text with markdown link
        markdownContent = markdownContent.replace(
          new RegExp(`\\b${text}\\b`, 'g'), 
          `[${text}](${href})`
        );
      }
    });
    
    // Process images
    mainContent.find('img').each(function() {
      const src = $(this).attr('src');
      const alt = $(this).attr('alt') || 'Image';
      
      if (src) {
        markdownContent += `![${alt}](${src})\n\n`;
      }
    });
    
    // Process blockquotes
    mainContent.find('blockquote').each(function() {
      const text = $(this).text().trim();
      if (text) {
        markdownContent += `> ${text}\n\n`;
      }
    });
    
    // Add any remaining text (not in structured elements)
    const bodyText = mainContent.text().trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
      .replace(/\n+/g, '\n'); // Replace multiple newlines with a single newline
    
    // Extract text that might not have been captured by specific elements
    const allExtractedText = markdownContent.replace(/[#\-*\[\]\(\)\!>]/g, '').trim();
    const remainingText = bodyText.replace(allExtractedText, '').trim();
    
    if (remainingText) {
      markdownContent += remainingText + '\n\n';
    }
    
    // Clean up the markdown
    return markdownContent
      .replace(/\n{3,}/g, '\n\n') // Replace three or more newlines with two
      .trim();
  } catch (error) {
    logger.error('Error extracting text content:', error.message);
    return '';
  }
}

// Update the scrapeWebContent function with better error handling

const scrapeWebContent = async (url, ContentModel, requestId) => {
  try {
    logger.info(`Scraping ${url} for bambisleep text content`);
    
    // Add timeout and better error handling for the HTTP request
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      },
      timeout: 15000 // 15 second timeout
    });
    
    const html = response.data;
    
    // Check if we got valid HTML
    if (!html || typeof html !== 'string' || html.trim() === '') {
      logger.warning(`No valid HTML content found at ${url}`);
      
      parentPort.postMessage({
        type: 'scrape_result',
        data: {
          success: true,
          message: `No valid HTML content at ${url}`,
          contentFound: false,
          content: '',
          error: 'Empty or invalid HTML response'
        },
        requestId: requestId
      });
      
      return {
        success: true,
        message: `No valid HTML content at ${url}`,
        contentFound: false,
        content: '',
        error: 'Empty or invalid HTML response'
      };
    }
    
    const pageText = extractTextContent(html);
    
    // If extraction produced empty text
    if (!pageText || pageText.trim() === '') {
      logger.warning(`No text content extracted from ${url}`);
      
      parentPort.postMessage({
        type: 'scrape_result',
        data: {
          success: true,
          message: `No text content extracted from ${url}`,
          contentFound: false,
          content: '',
          error: 'No text content could be extracted'
        },
        requestId: requestId
      });
      
      return {
        success: true,
        message: `No text content extracted from ${url}`,
        contentFound: false,
        content: '',
        error: 'No text content could be extracted'
      };
    }
    
    // Check if the page contains bambisleep-related content
    if (pageText.toLowerCase().includes('bambisleep') || 
        pageText.toLowerCase().includes('bambi sleep')) {
      // Continue with the existing code for saving content...
      
      // Extract page metadata
      const $ = cheerio.load(html);
      const title = $('title').text();
      const description = $('meta[name="description"]').attr('content') || '';
      const keywords = $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim()) || [];
      
      // Store text content with HTML formatting instead of markdown
      const textContent = new ContentModel({
        type: 'text',
        fileType: 'html', // Changed from 'markdown' to 'html'
        title: title,
        content: pageText, // Still contains markdown formatted text
        url: url,
        source: 'web',
        metadata: {
          keywords: keywords,
          description: description,
          categories: ['web'],
          created: new Date()
        },
        mediaType: 'html' // Changed from 'markdown' to 'html'
      });
      
      await textContent.save();
      logger.success(`Saved bambisleep text content from ${url}`);
      
      parentPort.postMessage({
        type: 'scrape_result',
        data: {
          success: true,
          contentFound: true,
          content: pageText // The extracted markdown content
        },
        requestId: requestId
      });
      
      return {
        success: true,
        message: `Found and stored bambisleep text content from ${url}`,
        contentFound: true,
        content: pageText
      };
    } else {
      logger.info(`No bambisleep content found at ${url}`);
      
      parentPort.postMessage({
        type: 'scrape_result',
        data: {
          success: true,
          message: `No bambisleep content found at ${url}`,
          contentFound: false,
          content: pageText, // Return the text anyway for debugging
          error: 'No BambiSleep content detected'
        },
        requestId: requestId
      });
      
      return {
        success: true,
        message: `No bambisleep content found at ${url}`,
        contentFound: false,
        content: pageText, // Return the text anyway for debugging
        error: 'No BambiSleep content detected'
      };
    }
  } catch (error) {
    // Enhanced error handling with more specific error messages
    const errorMessage = error.response ? 
      `HTTP ${error.response.status}: ${error.response.statusText}` : 
      error.message;
    
    const errorDetails = {
      message: errorMessage,
      isNetworkError: error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT',
      isAccessError: error.response && (error.response.status === 403 || error.response.status === 401),
      isTimeoutError: error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT',
      isSSLError: error.code === 'EPROTO' || error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT'
    };
    
    logger.error(`Error scraping ${url}:`, errorMessage);
    
    parentPort.postMessage({
      type: 'scrape_result',
      data: {
        success: false,
        message: `Error scraping ${url}: ${errorMessage}`,
        contentFound: false,
        content: '',
        error: errorDetails
      },
      requestId: requestId
    });
    
    return {
      success: false,
      message: `Error scraping ${url}: ${errorMessage}`,
      contentFound: false,
      content: '',
      error: errorDetails
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
        const urlResult = await scrapeWebContent(msg.url, ContentModel, msg.requestId);
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