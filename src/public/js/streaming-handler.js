// streaming-handler.js - Frontend streaming support
document.addEventListener('DOMContentLoaded', () => {
  // Element references
  let responseElement = null;
  let currentStreamElement = null;
  let eyeCursor = null;
  
  // Check if we're on a page with streaming elements
  responseElement = document.getElementById('response') || document.getElementById('chat-messages');
  eyeCursor = document.getElementById('eyeCursor');
  
  if (!responseElement) return; // Not on a page that needs streaming support
  
  // Initialize streaming state
  const streamState = {
    active: false,
    content: '',
    startTime: null,
    container: null,
    cursorBlinking: false
  };
  
  // Set up socket listeners for streaming events
  if (typeof socket !== 'undefined') {
    // Stream start event
    socket.on('stream:start', (data) => {
      console.log('Stream started');
      streamState.active = true;
      streamState.content = '';
      streamState.startTime = Date.now();
      
      // Show typing indicator
      showStreamingCursor();
      
      // Create container for this stream
      createStreamContainer(data);
    });
    
    // Stream chunk event
    socket.on('stream:chunk', (data) => {
      if (!streamState.active) {
        // Stream wasn't properly started, handle start now
        streamState.active = true;
        streamState.content = '';
        streamState.startTime = Date.now();
        createStreamContainer({ username: data.username || 'BambiAI' });
      }
      
      // Add chunk to content
      streamState.content += data.chunk;
      
      // Update display
      updateStreamDisplay(data.chunk);
    });
    
    // Stream end event
    socket.on('stream:end', (data) => {
      console.log('Stream ended');
      
      // Update UI with final content if needed
      if (streamState.content !== data.data) {
        streamState.content = data.data;
        finalizeStreamDisplay(data.data);
      } else {
        finalizeStreamDisplay();
      }
      
      // Reset state
      streamState.active = false;
      hideStreamingCursor();
      
      // Add message to session if needed
      if (typeof currentSession !== 'undefined' && currentSession.messages) {
        currentSession.messages.push({
          role: 'assistant',
          content: data.data,
          timestamp: new Date()
        });
      }
    });
    
    // Handle stream errors
    socket.on('stream:error', (data) => {
      console.error('Stream error:', data.error);
      
      // Show error in stream container
      if (streamState.container) {
        const errorMsg = document.createElement('p');
        errorMsg.className = 'stream-error';
        errorMsg.textContent = `Error: ${data.error}`;
        streamState.container.appendChild(errorMsg);
      }
      
      // Reset state
      streamState.active = false;
      hideStreamingCursor();
    });
  }
  
  // Helper to show streaming cursor animation
  function showStreamingCursor() {
    if (!eyeCursor) return;
    
    eyeCursor.classList.add('streaming');
    streamState.cursorBlinking = true;
    
    // Position near the input area
    const inputArea = document.querySelector('.chat-input-container') || 
                     document.querySelector('#user-input');
    
    if (inputArea) {
      const rect = inputArea.getBoundingClientRect();
      eyeCursor.style.top = `${rect.top - 50}px`;
      eyeCursor.style.left = `${rect.left + rect.width / 2}px`;
    }
    
    eyeCursor.style.display = 'block';
  }
  
  // Helper to hide streaming cursor
  function hideStreamingCursor() {
    if (!eyeCursor) return;
    
    eyeCursor.classList.remove('streaming');
    streamState.cursorBlinking = false;
    
    // Don't hide immediately for smoother transition
    setTimeout(() => {
      if (!streamState.cursorBlinking) {
        eyeCursor.style.display = 'none';
      }
    }, 500);
  }
  
  // Create container for the stream content
  function createStreamContainer(data) {
    // Different handling based on page type
    if (document.body.classList.contains('advanced-chat') || 
        document.querySelector('.chat-messages')) {
      // Advanced chat view
      const messagesContainer = document.getElementById('chat-messages');
      if (!messagesContainer) return;
      
      const messageElement = document.createElement('div');
      messageElement.className = 'chat-message-item';
      
      const header = document.createElement('div');
      header.className = 'message-header';
      
      const time = document.createElement('span');
      time.className = 'message-time';
      time.textContent = new Date().toLocaleTimeString([], {hour12: false});
      
      const username = document.createElement('span');
      username.className = 'message-username';
      
      const usernameLink = document.createElement('a');
      usernameLink.href = `/profile/${data.username || 'BambiAI'}`;
      usernameLink.className = 'username-link';
      usernameLink.textContent = data.username || 'BambiAI';
      
      username.appendChild(usernameLink);
      header.appendChild(time);
      header.appendChild(username);
      
      const content = document.createElement('div');
      content.className = 'message-content streaming-content';
      
      messageElement.appendChild(header);
      messageElement.appendChild(content);
      
      messagesContainer.appendChild(messageElement);
      
      // Set as current stream container
      streamState.container = content;
      currentStreamElement = messageElement;
      
      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
      // Classic chat view
      const responseContainer = document.getElementById('response');
      if (!responseContainer) return;
      
      const messageElement = document.createElement('div');
      messageElement.className = 'response-message streaming-message';
      
      const header = document.createElement('div');
      header.className = 'response-header';
      header.textContent = 'BambiAI is typing...';
      
      const content = document.createElement('div');
      content.className = 'response-content streaming-content';
      
      messageElement.appendChild(header);
      messageElement.appendChild(content);
      
      responseContainer.appendChild(messageElement);
      
      // Set as current stream container
      streamState.container = content;
      currentStreamElement = messageElement;
      
      // Scroll into view
      messageElement.scrollIntoView({ behavior: 'smooth' });
    }
  }
  
  // Update the stream display with new chunk
  function updateStreamDisplay(chunk) {
    if (!streamState.container) return;
    
    // Append new content
    streamState.container.textContent = streamState.content;
    
    // Scroll to bottom if container is scrollable
    if (streamState.container.scrollHeight > streamState.container.clientHeight) {
      streamState.container.scrollTop = streamState.container.scrollHeight;
    }
    
    // If inside a chat messages container, scroll that too
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
  
  // Finalize the stream display when complete
  function finalizeStreamDisplay(finalContent) {
    if (!streamState.container) return;
    
    // Update with final content if provided
    if (finalContent) {
      streamState.container.textContent = finalContent;
    }
    
    // Remove streaming indicator styles
    streamState.container.classList.remove('streaming-content');
    
    if (currentStreamElement) {
      currentStreamElement.classList.remove('streaming-message');
      
      // Update header if present
      const header = currentStreamElement.querySelector('.response-header');
      if (header && header.textContent.includes('typing')) {
        header.textContent = 'BambiAI';
      }
    }
    
    // Final scroll to ensure visibility
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else if (streamState.container.scrollHeight > streamState.container.clientHeight) {
      streamState.container.scrollTop = streamState.container.scrollHeight;
    }
  }
  
  // Expose useful functions
  window.streamingHandler = {
    isActive: () => streamState.active,
    getContent: () => streamState.content,
    cancel: () => {
      if (streamState.active && typeof socket !== 'undefined') {
        socket.emit('stream:cancel');
        streamState.active = false;
        hideStreamingCursor();
      }
    }
  };
});
