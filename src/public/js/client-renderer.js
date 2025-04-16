/**
 * Client-side renderer for dynamic components
 * Reduces server load by moving rendering to browser
 */
class ClientRenderer {
  constructor() {
    this.componentCache = new Map();
    this.pendingRenders = new Set();
    this.initialized = false;
    this.templates = {};
    this.errorCount = 0;
  }

  /**
   * Initialize the renderer when DOM is ready
   */
  init() {
    if (this.initialized) return;
    
    console.log('Initializing client renderer...');
    
    // Find all client-render placeholders
    document.querySelectorAll('[data-client-render]').forEach(placeholder => {
      try {
        const componentType = placeholder.dataset.clientRender;
        const propsString = placeholder.dataset.props;
        let dataProps = {};
        
        if (propsString) {
          try {
            dataProps = JSON.parse(propsString);
          } catch (jsonError) {
            console.error(`Error parsing props for ${componentType}:`, jsonError);
            console.log('Props string was:', propsString);
          }
        }
        
        // Render the component
        this.renderComponent(placeholder, componentType, dataProps);
      } catch (err) {
        console.error('Error processing client-render element:', err);
      }
    });
    
    // Setup mutation observer to handle dynamically added placeholders
    this.setupMutationObserver();
    this.initialized = true;
    
    console.log('Client renderer initialized');
  }
  
  /**
   * Setup mutation observer to watch for new client-render elements
   */
  setupMutationObserver() {
    try {
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Check the added node itself
                if (node.hasAttribute && node.hasAttribute('data-client-render')) {
                  const componentType = node.dataset.clientRender;
                  let dataProps = {};
                  
                  if (node.dataset.props) {
                    try {
                      dataProps = JSON.parse(node.dataset.props);
                    } catch (jsonError) {
                      console.error(`Error parsing props for ${componentType}:`, jsonError);
                    }
                  }
                  
                  this.renderComponent(node, componentType, dataProps);
                }
                
                // Also check children of the added node
                if (node.querySelectorAll) {
                  node.querySelectorAll('[data-client-render]').forEach(placeholder => {
                    const componentType = placeholder.dataset.clientRender;
                    let dataProps = {};
                    
                    if (placeholder.dataset.props) {
                      try {
                        dataProps = JSON.parse(placeholder.dataset.props);
                      } catch (jsonError) {
                        console.error(`Error parsing props for ${componentType}:`, jsonError);
                      }
                    }
                    
                    this.renderComponent(placeholder, componentType, dataProps);
                  });
                }
              }
            });
          }
        });
      });
      
      observer.observe(document.body, { 
        childList: true, 
        subtree: true 
      });
    } catch (err) {
      console.error('Error setting up mutation observer:', err);
    }
  }
  
  /**
   * Render a component in a placeholder element
   * 
   * @param {Element} placeholder - Element to replace with component
   * @param {string} componentType - Type of component to render
   * @param {Object} props - Properties for the component
   */
  renderComponent(placeholder, componentType, props = {}) {
    if (!placeholder || this.pendingRenders.has(placeholder)) return;
    
    try {
      this.pendingRenders.add(placeholder);
      
      // Check if component renderer exists
      const rendererMethod = `render${componentType}`;
      
      if (typeof this[rendererMethod] !== 'function') {
        console.error(`No renderer found for component type: ${componentType}`);
        placeholder.innerHTML = `<div class="error-message">Component "${componentType}" not found</div>`;
        this.pendingRenders.delete(placeholder);
        return;
      }
      
      // Track render performance
      const startTime = performance.now();
      
      // Render the component
      this[rendererMethod](placeholder, props)
        .then(() => {
          // Record rendering time for performance monitoring
          if (window.performanceMonitor) {
            window.performanceMonitor.recordRender(componentType, startTime);
          }
        })
        .catch(err => {
          console.error(`Error rendering ${componentType}:`, err);
          placeholder.innerHTML = `<div class="error-message">Error rendering ${componentType}</div>`;
          
          // Count errors to avoid infinite error loops
          this.errorCount++;
          if (this.errorCount > 10) {
            console.error('Too many rendering errors, disabling client renderer');
            this.initialized = false;
          }
        })
        .finally(() => {
          this.pendingRenders.delete(placeholder);
        });
    } catch (err) {
      console.error(`Unexpected error in renderComponent for ${componentType}:`, err);
      this.pendingRenders.delete(placeholder);
      
      // Try to show error in the UI
      try {
        placeholder.innerHTML = `<div class="error-message">Rendering error: ${err.message}</div>`;
      } catch (uiErr) {
        // Last resort - just log the error
        console.error('Failed to display error in UI:', uiErr);
      }
    }
  }
  
  /**
   * Render chat messages
   * 
   * @param {Element} placeholder - Element to replace with chat messages
   * @param {Object} props - Properties for the component
   * @returns {Promise} - Promise that resolves when rendering is complete
   */
  async renderChatMessages(placeholder, props) {
    // Create chat messages container
    const container = document.createElement('ul');
    container.id = 'chat-response';
    
    // If we have messages in props, use them
    if (props.messages && Array.isArray(props.messages) && props.messages.length > 0) {
      props.messages.forEach(msg => {
        container.appendChild(this.createChatMessageElement(msg));
      });
    } else {
      // Otherwise fetch messages from API
      try {
        const response = await fetch('/api/chat/messages?limit=50');
        const data = await response.json();
        
        if (data.messages && Array.isArray(data.messages)) {
          data.messages.forEach(msg => {
            container.appendChild(this.createChatMessageElement(msg));
          });
        }
      } catch (err) {
        console.error('Error fetching chat messages:', err);
        container.innerHTML = '<li class="error-message">Error loading chat messages</li>';
      }
    }
    
    // Replace placeholder with container
    this.safeReplace(placeholder, container);
    
    // Remove any existing listeners before adding a new one
    if (window.socket) {
      window.socket.off("chat message");
      window.socket.on("chat message", (msg) => {
        const item = this.createChatMessageElement(msg);
        container.appendChild(item);
        
        // Limit number of messages to prevent performance issues
        if (container.children.length > 100) {
          container.removeChild(container.firstChild);
        }
      });
    }
    
    return Promise.resolve();
  }
  
  /**
   * Create a chat message element
   * 
   * @param {Object} msg - Message data
   * @returns {Element} - Chat message list item
   */
  createChatMessageElement(msg) {
    const item = document.createElement("li");
    
    try {
      const timestamp = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {hour12: false});
      
      const timeSpan = document.createElement("span");
      timeSpan.classList.add("chat-time");
      timeSpan.textContent = timestamp;
      
      const usernameSpan = document.createElement("span");
      usernameSpan.classList.add("chat-username");
      
      // Create clickable username link
      const usernameLink = document.createElement("a");
      usernameLink.href = `/profile/${msg.username || 'anonymous'}`;
      usernameLink.className = "username-link";
      usernameLink.textContent = msg.username || 'anonymous';
      usernameSpan.appendChild(usernameLink);
      usernameSpan.appendChild(document.createTextNode(":"));
      
      const messageSpan = document.createElement("span");
      messageSpan.classList.add("chat-message");
      messageSpan.textContent = msg.data || msg.message || '';
      
      item.appendChild(timeSpan);
      item.appendChild(document.createTextNode(" - "));
      item.appendChild(usernameSpan);
      item.appendChild(document.createTextNode(" "));
      item.appendChild(messageSpan);
      
      // Add styling if needed
      if (window.username) {
        item.classList.add("neon-glow");
      }
    } catch (err) {
      console.error('Error creating chat message element:', err);
      item.textContent = 'Error displaying message';
      item.classList.add('error-message');
    }
    
    return item;
  }
  
  /**
   * Render profile system controls
   * 
   * @param {Element} placeholder - Element to replace with system controls
   * @param {Object} props - Properties for the component
   * @returns {Promise} - Promise that resolves when rendering is complete
   */
  async renderSystemControls(placeholder, props) {
    // Create container for system controls
    const container = document.createElement('div');
    container.className = 'system-controls';
    
    try {
      // Get username from props or from window
      const username = props.username || window.username || '';
      
      if (!username) {
        container.innerHTML = '<p>Please log in to view system controls</p>';
        this.safeReplace(placeholder, container);
        return Promise.resolve();
      }
      
      container.innerHTML = '<p>Loading system controls...</p>';
      this.safeReplace(placeholder, container);
      
      // Change endpoint from /profile/${username}/system-controls to /api/profile/${username}/system-controls
      const response = await fetch(`/api/profile/${username}/system-controls`);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      // Build the controls UI based on the data
      container.innerHTML = this.buildSystemControlsUI(data);
      
      // Setup event handlers
      this.setupSystemControlsEvents(container, data);
    } catch (err) {
      console.error('Error loading system controls:', err);
      container.innerHTML = '<p>Error loading system controls</p>';
      
      // Replace placeholder if it hasn't been replaced yet
      if (placeholder.parentNode) {
        this.safeReplace(placeholder, container);
      }
    }
    
    return Promise.resolve();
  }
  
  /**
   * Build system controls UI HTML
   * 
   * @param {Object} data - System controls data
   * @returns {string} - HTML for system controls
   */
  buildSystemControlsUI(data) {
    return `
      <div class="profile-system-controls">
        <div class="controls-header">
          <h3>System Controls</h3>
        </div>
        <div class="controls-content">
          ${this.buildTriggersList(data.activeTriggers || [])}
        </div>
      </div>
    `;
  }
  
  /**
   * Build triggers list HTML
   * 
   * @param {Array} triggers - List of active triggers
   * @returns {string} - HTML for triggers list
   */
  buildTriggersList(triggers) {
    if (!triggers || !Array.isArray(triggers) || triggers.length === 0) {
      return '<p>No active triggers</p>';
    }
    
    return `
      <div class="triggers-list">
        <h4>Active Triggers</h4>
        <ul>
          ${triggers.map(trigger => `<li>${this.escapeHtml(trigger)}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  /**
   * Escape HTML to prevent XSS
   * 
   * @param {string} html - Input string
   * @returns {string} - Escaped string
   */
  escapeHtml(html) {
    if (typeof html !== 'string') return '';
    
    return html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  
  /**
   * Setup event handlers for system controls
   * 
   * @param {Element} container - Container element
   * @param {Object} data - System controls data
   */
  setupSystemControlsEvents(container, data) {
    // Add event handlers for buttons, triggers, etc.
    // This will be implemented based on your specific controls
  }
  
  /**
   * Safely replace a DOM element with another, with error handling
   * 
   * @param {Element} oldElement - Element to replace
   * @param {Element} newElement - Element to replace with
   */
  safeReplace(oldElement, newElement) {
    try {
      if (oldElement && oldElement.parentNode) {
        oldElement.parentNode.replaceChild(newElement, oldElement);
      }
    } catch (err) {
      console.error('Error replacing element:', err);
    }
  }
  
  /**
   * Clear component cache to free memory
   */
  clearComponentCache() {
    this.componentCache.clear();
    console.log('Component cache cleared');
  }
}

// Initialize client renderer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    window.clientRenderer = new ClientRenderer();
    window.clientRenderer.init();
  } catch (err) {
    console.error('Error initializing client renderer:', err);
  }
});