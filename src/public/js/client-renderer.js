/**
 * Client-side renderer for dynamic components
 * Reduces server load by moving rendering to browser
 */
class ClientRenderer {
  constructor() {
    this.componentCache = new Map();
    this.pendingRenders = new Set();
    this.initialized = false;
  }

  /**
   * Initialize the renderer when DOM is ready
   */
  init() {
    if (this.initialized) return;
    
    // Find all client-render placeholders
    document.querySelectorAll('[data-client-render]').forEach(placeholder => {
      const componentType = placeholder.dataset.clientRender;
      const dataProps = placeholder.dataset.props ? JSON.parse(placeholder.dataset.props) : {};
      
      // Render the component
      this.renderComponent(placeholder, componentType, dataProps);
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
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check the added node itself
              if (node.hasAttribute('data-client-render')) {
                const componentType = node.dataset.clientRender;
                const dataProps = node.dataset.props ? JSON.parse(node.dataset.props) : {};
                this.renderComponent(node, componentType, dataProps);
              }
              
              // Also check children of the added node
              node.querySelectorAll('[data-client-render]').forEach(placeholder => {
                const componentType = placeholder.dataset.clientRender;
                const dataProps = placeholder.dataset.props ? JSON.parse(placeholder.dataset.props) : {};
                this.renderComponent(placeholder, componentType, dataProps);
              });
            }
          });
        }
      });
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  }
  
  /**
   * Render a component in a placeholder element
   * 
   * @param {Element} placeholder - Element to replace with component
   * @param {string} componentType - Type of component to render
   * @param {Object} props - Properties for the component
   */
  renderComponent(placeholder, componentType, props = {}) {
    if (this.pendingRenders.has(placeholder)) return;
    this.pendingRenders.add(placeholder);
    
    // Check if component renderer exists
    if (typeof this[`render${componentType}`] !== 'function') {
      console.error(`No renderer found for component type: ${componentType}`);
      this.pendingRenders.delete(placeholder);
      return;
    }
    
    // Render the component
    try {
      this[`render${componentType}`](placeholder, props);
    } catch (err) {
      console.error(`Error rendering ${componentType}:`, err);
    }
    
    this.pendingRenders.delete(placeholder);
  }
  
  /**
   * Render chat messages
   * 
   * @param {Element} placeholder - Element to replace with chat messages
   * @param {Object} props - Properties for the component
   */
  renderChatMessages(placeholder, props) {
    // Create chat messages container
    const container = document.createElement('ul');
    container.id = 'chat-response';
    
    // Add initial messages if provided
    if (props.messages && props.messages.length > 0) {
      props.messages.forEach(msg => {
        container.appendChild(this.createChatMessageElement(msg));
      });
    }
    
    // Replace placeholder with container
    placeholder.replaceWith(container);
    
    // Set up socket listener for new messages
    if (window.socket) {
      window.socket.on("chat message", (msg) => {
        const item = this.createChatMessageElement(msg);
        container.appendChild(item);
        
        // Limit number of messages to prevent performance issues
        if (container.children.length > 100) {
          container.removeChild(container.firstChild);
        }
      });
    }
  }
  
  /**
   * Create a chat message element
   * 
   * @param {Object} msg - Message data
   * @returns {Element} - Chat message list item
   */
  createChatMessageElement(msg) {
    const item = document.createElement("li");
    const timestamp = new Date(msg.timestamp).toLocaleTimeString([], {hour12: false});
    
    const timeSpan = document.createElement("span");
    timeSpan.classList.add("chat-time");
    timeSpan.textContent = timestamp;
    
    const usernameSpan = document.createElement("span");
    usernameSpan.classList.add("chat-username");
    
    // Create clickable username link
    const usernameLink = document.createElement("a");
    usernameLink.href = `/profile/${msg.username}`;
    usernameLink.className = "username-link";
    usernameLink.textContent = msg.username;
    usernameSpan.appendChild(usernameLink);
    usernameSpan.appendChild(document.createTextNode(":"));
    
    const messageSpan = document.createElement("span");
    messageSpan.classList.add("chat-message");
    messageSpan.textContent = msg.data;
    
    item.appendChild(timeSpan);
    item.appendChild(document.createTextNode(" - "));
    item.appendChild(usernameSpan);
    item.appendChild(document.createTextNode(" "));
    item.appendChild(messageSpan);
    
    if (window.username) {
      item.classList.add("neon-glow");
    }
    
    return item;
  }
  
  /**
   * Render profile system controls
   * 
   * @param {Element} placeholder - Element to replace with system controls
   * @param {Object} props - Properties for the component
   */
  renderSystemControls(placeholder, props) {
    // Create container for system controls
    const container = document.createElement('div');
    container.className = 'system-controls';
    
    // Fetch system controls data from API
    fetch(`/profile/${props.username || window.username}/system-controls`)
      .then(response => response.json())
      .then(data => {
        // Build the controls UI based on the data
        const controls = this.buildSystemControlsUI(data);
        container.innerHTML = controls;
        
        // Setup event handlers
        this.setupSystemControlsEvents(container, data);
        
        // Replace placeholder with controls
        placeholder.replaceWith(container);
      })
      .catch(err => {
        console.error('Error loading system controls:', err);
        container.innerHTML = '<p>Error loading system controls</p>';
        placeholder.replaceWith(container);
      });
  }
  
  /**
   * Build system controls UI HTML
   * 
   * @param {Object} data - System controls data
   * @returns {string} - HTML for system controls
   */
  buildSystemControlsUI(data) {
    // Implement according to your existing system controls HTML
    return `
      <div class="profile-system-controls">
        <div class="controls-header">
          <h3>System Controls</h3>
        </div>
        <div class="controls-content">
          <!-- Populate with actual controls based on data -->
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
    if (!triggers || triggers.length === 0) {
      return '<p>No active triggers</p>';
    }
    
    return `
      <div class="triggers-list">
        <h4>Active Triggers</h4>
        <ul>
          ${triggers.map(trigger => `<li>${trigger}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  /**
   * Setup event handlers for system controls
   * 
   * @param {Element} container - Container element
   * @param {Object} data - System controls data
   */
  setupSystemControlsEvents(container, data) {
    // Add event handlers for buttons, triggers, etc.
  }
}

// Initialize client renderer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.clientRenderer = new ClientRenderer();
  window.clientRenderer.init();
});