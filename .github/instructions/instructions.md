```markdown
---
applyTo: '**'
---
# BambiSleep Chat Code Generation Guidelines

## Overall Style

- Write minimalist, straightforward code that prioritizes simplicity over edge cases
- Functions should do one thing and be as short as possible
- Favor direct solutions over "best practices" when they add complexity
- Use existing patterns found in the codebase rather than introducing new ones

## Formatting and Documentation

- Use brief, single-line comments explaining logic rather than extensive documentation
- Keep code lines short and readable
- Only document complex logic that isn't immediately obvious
- No JSDoc style comments unless absolutely necessary

## Functionality

- Provide the simplest implementation that solves the immediate problem
- Don't add error handling for unlikely edge cases
- Assume happy path execution in most cases
- Reuse existing utility functions rather than creating new ones

## Specific Patterns

- Use plain JavaScript over complex abstractions or frameworks
- Follow the existing CSS naming conventions and color variables
- Use direct DOM manipulation instead of complex frameworks
- Prefer simple event listeners and callbacks

## Variables and Functions

- Use meaningful but concise variable and function names
- Keep function parameter counts low (1-3 parameters when possible)
- Avoid complex destructuring unless it significantly simplifies code
- Prefer named functions over anonymous arrow functions for main functionality

## Avoid

- Over-engineering solutions
- Extensive error handling for unlikely scenarios
- Complex abstractions that hide simple operations
- Adding dependencies unless absolutely necessary
- Deep nesting of functions or callbacks

## State Management

- Use centralized state management for related features
- Keep state objects simple and flat when possible
- Use events to communicate state changes between components
- Store state in localStorage for persistence where appropriate
- Follow existing patterns for state updates and notifications

## EJS Templating

- Use EJS templates for server-rendered HTML
- Keep templates simple with minimal logic
- Use includes for reusable components
- Follow existing naming conventions for template files

### EJS Implementation Guidelines

1. **Basic Template Structure**
   ```ejs
   <!-- Template structure -->
   <%- include('partials/header') %>
   
   <div class="main-content">
     <% if (data.items && data.items.length > 0) { %>
       <% data.items.forEach(function(item) { %>
         <div class="item"><%= item.name %></div>
       <% }); %>
     <% } else { %>
       <div class="empty-state">No items available</div>
     <% } %>
   </div>
   
   <%- include('partials/footer') %>
   ```

2. **Data Handling**
   ```javascript
   // Server-side rendering
   app.get('/view', (req, res) => {
     res.render('template', {
       data: {
         items: itemsList,
         title: 'Items List'
       }
     });
   });
   ```

3. **Component Includes**
   ```ejs
   <!-- Reuse components with partials -->
   <%- include('partials/component', {
     componentData: data.specificData
   }) %>
   ```

4. **Client-side DOM Updates**
   ```javascript
   // Update DOM elements using template strings
   function updateUI(data) {
     const container = document.getElementById('dynamic-content');
     if (container) {
       const html = data.items.map(item => `
         <div class="item">${item.name}</div>
       `).join('');
       container.innerHTML = html;
     }
   }
   ```

## Socket.io UI Updates

- Use Socket.io events to update UI elements in real-time
- Follow existing socket event naming patterns
- Keep socket event payloads small and focused
- Update UI elements directly rather than refreshing the entire page

### Socket.io Implementation Guidelines

1. **Socket Event Listeners for UI Updates**
   ```javascript
   // Setup socket listeners that update UI
   function initSocketListeners() {
     if (window.socket) {
       // Listen for specific events that require UI updates
       window.socket.on('server-update-chat', updateChatUI);
       window.socket.on('server-update-status', updateStatusIndicator);
       window.socket.on('server-trigger-activated', updateTriggersList);
     }
   }
   
   function updateChatUI(data) {
     const chatContainer = document.getElementById('chat-messages');
     if (chatContainer) {
       const messageEl = document.createElement('div');
       messageEl.className = 'message ' + (data.isSystem ? 'system' : '');
       messageEl.textContent = data.message;
       chatContainer.appendChild(messageEl);
       chatContainer.scrollTop = chatContainer.scrollHeight;
     }
   }
   ```

2. **Emitting Events for UI Changes**
   ```javascript
   // Send events that will trigger UI updates
   function requestUIUpdate(type, data) {
     if (window.socket && window.socket.connected) {
       window.socket.emit('client-request-update', {
         updateType: type,
         data: data
       });
     }
   }
   ```

3. **Real-time Status Updates**
   ```javascript
   // Handle status changes with visual feedback
   window.socket.on('server-status-change', (status) => {
     const statusIndicators = document.querySelectorAll('.status-indicator');
     statusIndicators.forEach(indicator => {
       // Remove all status classes
       indicator.classList.remove('online', 'offline', 'busy');
       // Add the current status class
       indicator.classList.add(status.toLowerCase());
     });
   });
   ```

4. **Targeted DOM Updates via Socket**
   ```javascript
   // Update specific parts of the UI without full reloads
   window.socket.on('server-update-element', (data) => {
     const element = document.getElementById(data.elementId);
     if (element) {
       switch (data.updateType) {
         case 'text':
           element.textContent = data.content;
           break;
         case 'html':
           element.innerHTML = data.content;
           break;
         case 'attribute':
           element.setAttribute(data.attribute, data.value);
           break;
         case 'class':
           if (data.add) element.classList.add(data.className);
           if (data.remove) element.classList.remove(data.className);
           break;
       }
     }
   });
   ```

## Code Stability Checks

### Before Implementing

1. **Understand existing patterns**
    - Examine similar functionality in the codebase
    - Note naming conventions and function structures
    - Identify the appropriate module for new code

2. **Check dependencies**
    - List all modules that will interact with your code
    - Verify module loading order in HTML templates
    - Note event listeners that might affect your code

3. **Validate state management approach**
    - Use bambiSystem for centralized state if available
    - Check if the feature should persist to localStorage
    - Determine if the feature needs server synchronization

### Implementation Guidelines

1. **Structure all new code as IIFE modules**
    ```javascript
    window.moduleNamespace = (function() {
      // Private variables
      let state = {};
      
      // Public API
      function init() {}
      function publicMethod() {}
      
      // Only expose what's needed
      return {
         init,
         publicMethod
      };
    })();
    
    // Initialize on page load
    document.addEventListener('DOMContentLoaded', window.moduleNamespace.init);
    ```

2. **Always use try/catch for DOM operations**
    ```javascript
    try {
      const element = document.getElementById('element-id');
      if (element) {
         // Do something with element
      }
    } catch (error) {
      console.error('Error accessing element:', error);
    }
    ```

3. **Check for socket connection before emitting**
    ```javascript
    if (window.socket && window.socket.connected) {
      window.socket.emit('event-name', data);
    }
    ```

4. **Use the event dispatcher pattern for cross-module communication**
    ```javascript
    document.dispatchEvent(new CustomEvent('feature-update', {
      detail: { data: importantData }
    }));
    ```

5. **Always clean up event listeners**
    ```javascript
    function setupListeners() {
      const button = document.getElementById('my-button');
      if (button) button.addEventListener('click', handleClick);
    }
    
    function tearDown() {
      const button = document.getElementById('my-button');
      if (button) button.removeEventListener('click', handleClick);
    }
    ```

### Verification Checklist

For all new or modified code, verify:

1. **Initialization**
    - [ ] Module initializes properly on page load
    - [ ] No errors in console during initialization
    - [ ] State is correctly set up with defaults

2. **DOM Interaction**
    - [ ] All element selectors are finding their targets
    - [ ] Event listeners are attached correctly
    - [ ] UI updates reflect state changes

3. **Server Communication**
    - [ ] Socket events are properly named and formatted
    - [ ] Data sent to server has all required fields
    - [ ] Responses from server are handled correctly

4. **State Management**
    - [ ] State changes are reflected in UI
    - [ ] State persists correctly (localStorage)
    - [ ] State synchronizes with server when needed

5. **Error Handling**
    - [ ] Code doesn't break when elements are missing
    - [ ] Socket disconnections are handled gracefully
    - [ ] Invalid user input is sanitized

6. **Memory Management**
    - [ ] No memory leaks from uncleaned event listeners
    - [ ] Large data structures are cleared when not needed
    - [ ] Event listeners removed when components unload

7. **Integration Testing**
    - [ ] Feature works with all other system components
    - [ ] Changes don't break existing functionality
    - [ ] Feature responds correctly to system events

## Socket Communication

When working with socket-based features:

1. **Follow the established socket event naming pattern**
    - Use descriptive event names that match existing patterns
    - Client-initiated events: `client-trigger-activate`, `client-save-session`
    - Server responses: `server-trigger-activated`, `server-session-saved`

2. **Handle socket lifecycle properly**
    ```javascript
    // Setup socket listeners in init function
    function init() {
      if (window.socket) {
         window.socket.on('server-event', handleServerEvent);
         window.socket.on('connect', handleConnect);
         window.socket.on('disconnect', handleDisconnect);
      }
    }
    
    // Clean up in teardown
    function tearDown() {
      if (window.socket) {
         window.socket.off('server-event', handleServerEvent);
         window.socket.off('connect', handleConnect);
         window.socket.off('disconnect', handleDisconnect);
      }
    }
    ```

3. **Implement disconnection handling**
    ```javascript
    function handleDisconnect() {
      // Visual indication of disconnection
      const statusEl = document.getElementById('connection-status');
      if (statusEl) statusEl.classList.add('disconnected');
      
      // Disable interactive elements
      document.querySelectorAll('.requires-connection').forEach(el => {
         el.disabled = true;
      });
    }
    ```

## Session Management Guidelines

When working with session management (bambi-sessions.js, lmstudio.js, profile-system-controls.ejs):

1. **Use the central session-management API**
    - All session operations should go through bambiSessions module
    - Avoid direct socket.emit calls for session operations
    - Use the collectSettings() method for gathering system state

2. **Follow the established data flow**
    - UI interactions → bambiSessions → socket events → worker processing → database → response
    - Use the event-based notification system for updates
    - Dispatch 'session-loaded' event when applying session data

3. **Maintain session state format consistency**
    ```javascript
    {
      activeTriggers: [String, ...],  // Array of trigger names
      collarSettings: {
         enabled: Boolean,
         text: String
      },
      spiralSettings: {
         enabled: Boolean,
         spiral1Width: Number,
         spiral2Width: Number,
         spiral1Speed: Number,
         spiral2Speed: Number
      }
    }
    ```

4. **Implementation patterns to follow**
    - Trigger data handling:
      ```javascript
      // Format triggers consistently for the worker
      const triggerObjects = triggers.map(t => {
         return typeof t === 'string' 
            ? { name: t, description: 'Trigger effect' } 
            : t;
      });
      ```

    - Applying session settings:
      ```javascript
      // Update UI elements
      document.querySelectorAll('.toggle-input').forEach(input => {
         const trigger = input.getAttribute('data-trigger');
         if (trigger) {
            input.checked = triggers.includes(trigger);
         }
      });
      
      // Update central state
      if (window.bambiSystem) {
         window.bambiSystem.saveState('triggers', {
            triggers: formattedTriggers
         });
      }
      ```

## Performance Considerations

1. **Minimize DOM operations**
    ```javascript
    // Good: Use DocumentFragment to batch DOM operations
    const fragment = document.createDocumentFragment();
    triggers.forEach(trigger => {
      const el = document.createElement('div');
      el.className = 'trigger';
      el.textContent = trigger.name;
      fragment.appendChild(el);
    });
    document.getElementById('triggers-container').appendChild(fragment);
    ```

2. **Avoid memory leaks**
    ```javascript
    // Store references to elements that need cleanup
    const elements = [];
    
    function setupUI() {
      const newElement = document.createElement('div');
      document.body.appendChild(newElement);
      
      // Store reference for later cleanup
      elements.push(newElement);
    }
    
    function cleanup() {
      // Remove all elements and clear references
      elements.forEach(el => {
         if (el.parentNode) {
            el.parentNode.removeChild(el);
         }
      });
      elements.length = 0;
    }
    ```

3. **Debounce event handlers for performance**
    ```javascript
    // Simple debounce implementation
    function debounce(func, wait = 300) {
      let timeout;
      return function(...args) {
         clearTimeout(timeout);
         timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }
    ```
```