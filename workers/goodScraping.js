import { parentPort } from 'worker_threads';
import axios from 'axios';
import cheerio from 'cheerio';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { patterns } from '../middleware/bambisleepChalk.js';
import dotenv from 'dotenv';

dotenv.config();

// MongoDB Schema for BambiSleep content
const ContentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'video', 'image', 'audio', 'document'],
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
    created: Date,
    duration: Number // for videos/audio
  },
  binaryData: Buffer,
  filePath: String,
  // Supporting common file types
  mediaType: {
    type: String,
    enum: [
      // Video types
      'mp4', 'webm', 'avi', 'mov', 'wmv',
      // Image types
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff', 'ico', 'heic',
      // Document types
      'pdf', 'doc', 'docx', 'txt', 'md', 'html', 'css', 'js', 'py', 'php',
      // Other
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
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep');
    console.log(patterns.server.success('MongoDB connected successfully'));
    return mongoose.model('BambiContent', ContentSchema);
  } catch (error) {
    console.error(patterns.server.error('MongoDB connection error:', error.message));
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
    console.error(patterns.server.error(`Error parsing ${fileType} content:`, error.message));
    return { raw: '', extracted: '' };
  }
};

// Web scraper function
const scrapeWebContent = async (url, ContentModel) => {
  try {
    console.log(patterns.server.info(`Scraping ${url} for bambisleep content`));
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
      
      // Find all images and videos
      const images = [];
      const videos = [];
      
      $('img').each((i, img) => {
        const src = $(img).attr('src');
        if (src) images.push(src);
      });
      
      $('video, source').each((i, video) => {
        const src = $(video).attr('src');
        if (src) videos.push(src);
      });
      
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
      console.log(patterns.server.success(`Saved bambisleep text content from ${url}`));
      
      // Process and store images
      for (const imgUrl of images) {
        try {
          const fullImgUrl = new URL(imgUrl, url).href;
          const response = await axios.get(fullImgUrl, { responseType: 'arraybuffer' });
          const extension = path.extname(imgUrl).substring(1).toLowerCase() || 'unknown';
          
          const imageContent = new ContentModel({
            type: 'image',
            fileType: extension,
            title: `Image from ${title}`,
            url: fullImgUrl,
            source: url,
            binaryData: Buffer.from(response.data),
            mediaType: extension
          });
          
          await imageContent.save();
        } catch (error) {
          console.error(patterns.server.error(`Error processing image ${imgUrl}:`, error.message));
        }
      }
      
      // Process and store videos
      for (const videoUrl of videos) {
        try {
          const fullVideoUrl = new URL(videoUrl, url).href;
          const extension = path.extname(videoUrl).substring(1).toLowerCase() || 'unknown';
          
          // For videos, we just store the URL rather than downloading the entire file
          const videoContent = new ContentModel({
            type: 'video',
            fileType: extension,
            title: `Video from ${title}`,
            url: fullVideoUrl,
            source: url,
            mediaType: extension
          });
          
          await videoContent.save();
        } catch (error) {
          console.error(patterns.server.error(`Error processing video ${videoUrl}:`, error.message));
        }
      }
      
      return {
        success: true,
        message: `Found and stored bambisleep content from ${url}`,
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
    console.error(patterns.server.error(`Error scraping ${url}:`, error.message));
    return {
      success: false,
      message: `Error scraping ${url}: ${error.message}`,
      contentFound: false
    };
  }
};

// Directory scanner to find local files
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
        
        // Check if it's a file type we can parse
        if (['md', 'txt', 'html', 'css', 'js', 'py', 'php'].includes(extension)) {
          const parsedContent = await parseContent(filePath, extension);
          
          // Check if content contains bambisleep references
          if (parsedContent.extracted.toLowerCase().includes('bambisleep') || 
              parsedContent.extracted.toLowerCase().includes('bambi sleep')) {
            
            const fileContent = new ContentModel({
              type: 'document',
              fileType: extension,
              title: file.name,
              content: parsedContent.extracted,
              filePath: filePath,
              source: 'local',
              mediaType: extension
            });
            
            await fileContent.save();
            results.push({
              file: file.name,
              path: filePath,
              contentFound: true
            });
          }
        } else if (['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm', 'avi', 'mov'].includes(extension)) {
          // For media files, we need to check the filename for now
          if (file.name.toLowerCase().includes('bambisleep') || 
              file.name.toLowerCase().includes('bambi sleep')) {
            
            const fileBuffer = await fs.readFile(filePath);
            
            const mediaContent = new ContentModel({
              type: extension.match(/jpg|jpeg|png|gif/) ? 'image' : 'video',
              fileType: extension,
              title: file.name,
              filePath: filePath,
              source: 'local',
              binaryData: fileBuffer,
              mediaType: extension
            });
            
            await mediaContent.save();
            results.push({
              file: file.name,
              path: filePath,
              contentFound: true
            });
          }
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error(patterns.server.error(`Error scanning directory ${dirPath}:`, error.message));
    return [];
  }
};

// Main function to handle worker messages
let ContentModel;
let isInitialized = false;

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
        // Search for content in the database
        const query = new RegExp(msg.query, 'i');
        const searchResults = await ContentModel.find({
          $or: [
            { content: query },
            { title: query },
            { 'metadata.description': query },
            { 'metadata.keywords': query }
          ]
        }).select('-binaryData').limit(20);
        
        parentPort.postMessage({
          type: 'search_result',
          data: searchResults,
          requestId: msg.requestId
        });
        break;
        
      case 'shutdown':
        console.log(patterns.server.info('Shutting down goodScraping worker...'));
        await mongoose.connection.close();
        process.exit(0);
        break;
        
      default:
        console.warn(patterns.server.warning(`Unknown message type: ${msg.type}`));
    }
  } catch (error) {
    console.error(patterns.server.error('Error handling message:', error));
    parentPort.postMessage({
      type: 'error',
      data: error.message,
      requestId: msg.requestId
    });
  }
});

console.log(patterns.server.info('GoodScraping worker started and ready to receive messages'));