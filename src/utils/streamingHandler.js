// streamingHandler.js - Support streaming responses from LM Studio
import Logger from './logger.js';
import axios from 'axios';

const logger = new Logger('StreamingHandler');

/**
 * Handle streaming responses from LM Studio
 */
class StreamingHandler {
  constructor() {
    this.activeStreams = new Map();
    this.abortControllers = new Map();
    this.streamingEnabled = true; // Can be toggled dynamically
  }

  /**
   * Check if streaming is supported and enabled
   * @returns {boolean} - Whether streaming is available
   */
  isStreamingEnabled() {
    return this.streamingEnabled;
  }

  /**
   * Toggle streaming support
   * @param {boolean} enabled - Whether to enable streaming
   */
  toggleStreaming(enabled) {
    this.streamingEnabled = Boolean(enabled);
    logger.info(`Streaming responses ${this.streamingEnabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Start a streaming response
   * @param {Object} requestData - Request data for the API
   * @param {string} socketId - Socket ID to stream to
   * @param {Function} onChunk - Callback for each chunk
   * @param {Function} onComplete - Callback when stream completes
   * @param {Function} onError - Callback when stream errors
   * @returns {string} - Stream ID
   */
  async startStream(requestData, socketId, onChunk, onComplete, onError) {
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Configure for streaming
    requestData.stream = true;
    
    // Create abort controller for this stream
    const controller = new AbortController();
    this.abortControllers.set(streamId, controller);
    
    // Store stream metadata
    this.activeStreams.set(streamId, {
      socketId,
      startTime: Date.now(),
      chunks: [],
      status: 'starting',
      requestData
    });

    // Start the streaming request
    try {
      const host = process.env.LMS_HOST || 'localhost';
      const port = process.env.LMS_PORT || '1234';
      
      logger.info(`Starting stream ${streamId} for socket ${socketId}`);
      
      // Set stream as active
      const streamData = this.activeStreams.get(streamId);
      streamData.status = 'active';
      this.activeStreams.set(streamId, streamData);
      
      // Make the API request
      const response = await axios({
        method: 'post',
        url: `http://${host}:${port}/v1/chat/completions`,
        data: requestData,
        responseType: 'stream',
        signal: controller.signal
      });
      
      // Process the streaming response
      let buffer = '';
      let fullContent = '';
      
      response.data.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        buffer += chunkStr;
        
        // Process complete JSON objects from the stream
        const lines = buffer.split('\n').filter(line => line.trim() !== '');
        
        // Reset buffer to anything after the last complete line
        buffer = lines.length > 0 && !buffer.endsWith('\n') 
          ? buffer.slice(buffer.lastIndexOf('\n') + 1) 
          : '';
        
        // Process each complete line
        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              // Stream completed
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                const delta = parsed.choices[0].delta;
                
                if (delta.content) {
                  fullContent += delta.content;
                  
                  // Store chunk
                  const streamData = this.activeStreams.get(streamId);
                  streamData.chunks.push(delta.content);
                  this.activeStreams.set(streamId, streamData);
                  
                  // Call chunk handler
                  onChunk(delta.content, streamId);
                }
              }
            } catch (err) {
              logger.warning(`Error parsing stream chunk: ${err.message}`);
            }
          }
        });
      });
      
      response.data.on('end', () => {
        logger.info(`Stream ${streamId} completed`);
        
        // Update stream status
        const streamData = this.activeStreams.get(streamId);
        streamData.status = 'completed';
        streamData.endTime = Date.now();
        streamData.fullContent = fullContent;
        this.activeStreams.set(streamId, streamData);
        
        // Cleanup
        this.abortControllers.delete(streamId);
        
        // Call completion handler
        onComplete(fullContent, streamId);
        
        // Remove stream data after a delay
        setTimeout(() => {
          this.activeStreams.delete(streamId);
        }, 60000); // Keep for 1 minute for debugging
      });
      
      response.data.on('error', (err) => {
        logger.error(`Stream ${streamId} error: ${err.message}`);
        
        // Update stream status
        const streamData = this.activeStreams.get(streamId);
        streamData.status = 'error';
        streamData.error = err.message;
        streamData.endTime = Date.now();
        this.activeStreams.set(streamId, streamData);
        
        // Cleanup
        this.abortControllers.delete(streamId);
        
        // Call error handler
        onError(err, streamId);
      });
      
      return streamId;
    } catch (error) {
      logger.error(`Error starting stream: ${error.message}`);
      
      // Update stream status
      const streamData = this.activeStreams.get(streamId);
      streamData.status = 'error';
      streamData.error = error.message;
      streamData.endTime = Date.now();
      this.activeStreams.set(streamId, streamData);
      
      // Cleanup
      this.abortControllers.delete(streamId);
      
      // Call error handler
      onError(error, streamId);
      
      throw error;
    }
  }

  /**
   * Cancel an active stream
   * @param {string} streamId - ID of stream to cancel
   * @returns {boolean} - Whether stream was cancelled
   */
  cancelStream(streamId) {
    const controller = this.abortControllers.get(streamId);
    
    if (!controller) {
      return false;
    }
    
    try {
      controller.abort();
      this.abortControllers.delete(streamId);
      
      // Update stream status
      const streamData = this.activeStreams.get(streamId);
      streamData.status = 'cancelled';
      streamData.endTime = Date.now();
      this.activeStreams.set(streamId, streamData);
      
      logger.info(`Stream ${streamId} cancelled`);
      return true;
    } catch (error) {
      logger.error(`Error cancelling stream ${streamId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get stats about active streams
   * @returns {Object} - Stream statistics
   */
  getStats() {
    return {
      activeStreams: this.activeStreams.size,
      streams: Array.from(this.activeStreams.entries()).map(([id, data]) => ({
        id,
        socketId: data.socketId,
        status: data.status,
        duration: data.endTime ? (data.endTime - data.startTime) : (Date.now() - data.startTime),
        chunkCount: data.chunks.length
      }))
    };
  }
}

// Export singleton
export default new StreamingHandler();
