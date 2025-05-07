window.responsiveModule = (function() {
  // Track event handlers for cleanup
  const eventHandlers = {};
  
  // Auto-expand textareas
  function autoExpand(element) {
    element.style.height = "inherit";
    const computed = window.getComputedStyle(element);
    const height =
      parseInt(computed.getPropertyValue("border-top-width"), 5) +
      parseInt(computed.getPropertyValue("border-bottom-width"), 5) +
      element.scrollHeight;
    element.style.height = height + "px";
  }

  // Initialize event listeners
  function init() {
    try {
      // Get both textareas and their respective submit buttons
      const mainTextarea = document.getElementById('textarea');
      const chatTextarea = document.getElementById('textarea-chat');
      const submitBtn = document.getElementById('submit');
      const sendChatBtn = document.getElementById('send');

      // Only add listeners if elements exist
      if (mainTextarea && submitBtn) {
        // Apply Enter key event listener to the main textarea
        eventHandlers.mainTextareaHandler = function(event) {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submitBtn.click();
          }
        };
        mainTextarea.addEventListener("keypress", eventHandlers.mainTextareaHandler);
      }

      if (chatTextarea && sendChatBtn) {
        // Apply Enter key event listener to the chat textarea
        eventHandlers.chatTextareaHandler = function(event) {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendChatBtn.click();
          }
        };
        chatTextarea.addEventListener("keypress", eventHandlers.chatTextareaHandler);
      }
      
      // Style existing content
      styleWordsBetweenPunctuation();
      
      // Sync triggers with system controls if available
      syncTriggersWithSystemControls();
      
      // Set up event handlers for system integration
      eventHandlers.triggerStateChanged = function(event) {
        if (event.detail && Array.isArray(event.detail.activeTriggers)) {
          updateUIFromTriggerState(event.detail.activeTriggers);
        }
      };
      document.addEventListener('trigger-state-changed', eventHandlers.triggerStateChanged);
      
      eventHandlers.systemControlsLoaded = syncTriggersWithSystemControls;
      document.addEventListener('system-controls-loaded', eventHandlers.systemControlsLoaded);
    } catch (error) {
      console.error('Error initializing responsive module:', error);
    }
  }

  // Style uppercase characters
  function applyUppercaseStyle() {
    try {
      const responseParagraphs = document.querySelectorAll('#response p');
      responseParagraphs.forEach(paragraph => {
        const text = paragraph.textContent;
        const styledText = text.replace(/([A-Z])/g, '<span class="uppercase-char">$1</span>');
        paragraph.innerHTML = styledText;
      });
    } catch (error) {
      console.error('Error applying uppercase style:', error);
    }
  }

  // Style text with punctuation
  function styleWordsBetweenPunctuation() {
    try {
      const responseParagraphs = document.querySelectorAll('#response p');
      responseParagraphs.forEach(paragraph => {
        let text = paragraph.innerHTML;
        text = text.replace(/"([^"]+)"/g, '<span style="font-style: italic;">"$1"</span>');
        text = text.replace(/\*([^*]+)\*/g, '<span style="font-weight: bold;">*$1*</span>');
        text = text.replace(/\*\*([^*]+)\*\*/g, '<span style="font-weight: bold; text-transform: uppercase;">**$1**</span>');
        paragraph.innerHTML = text;
      });
    } catch (error) {
      console.error('Error styling words with punctuation:', error);
    }
  }

  // Color matching username responses
  function colorMatchingUsernameResponses(profileUsername) {
    try {
      const responseParagraphs = document.querySelectorAll('#response p');
      responseParagraphs.forEach(paragraph => {
        if (paragraph.textContent.includes(profileUsername)) {
          paragraph.style.color = 'var(--tertiary-color)';
        }
      });
    } catch (error) {
      console.error('Error coloring username responses:', error);
    }
  }

  // Sync triggers with system controls
  function syncTriggersWithSystemControls() {
    try {
      // Find the active trigger toggles
      const triggerToggles = document.querySelectorAll('.trigger-toggle');
      
      if (triggerToggles.length > 0) {
        // Get active triggers
        const activeTriggers = Array.from(triggerToggles)
          .filter(toggle => toggle.checked)
          .map(toggle => toggle.getAttribute('data-trigger'))
          .filter(Boolean);
        
        // Get trigger descriptions if available
        const descriptions = {};
        triggerToggles.forEach(toggle => {
          const trigger = toggle.getAttribute('data-trigger');
          const description = toggle.getAttribute('data-description');
          
          if (trigger && description) {
            descriptions[trigger] = description;
          }
        });
        
        // First try to save to central state system
        if (window.bambiSystem) {
          window.bambiSystem.saveState('triggers', {
            activeTriggers: activeTriggers,
            triggerDescriptions: descriptions
          });
          
          // Dispatch event for other components to react
          document.dispatchEvent(new CustomEvent('trigger-state-changed', {
            detail: { activeTriggers, triggerDescriptions: descriptions }
          }));
          
          console.log('Synced triggers with central system:', activeTriggers);
        } 
        // Fallback to localStorage if bambiSystem is not available
        else {
          localStorage.setItem('bambiActiveTriggers', JSON.stringify(activeTriggers));
          localStorage.setItem('bambiTriggerDescriptions', JSON.stringify(descriptions));
          console.log('Synced triggers with localStorage (fallback):', activeTriggers);
        }
        
        // Send to server if socket is available
        if (window.socket && window.socket.connected) {
          window.socket.emit('active-triggers', {
            activeTriggers: activeTriggers,
            triggerDetails: activeTriggers.map(t => ({ 
              name: t, 
              description: descriptions[t] || '' 
            }))
          });
        }
      }
    } catch (error) {
      console.error('Error in syncTriggersWithSystemControls:', error);
    }
  }

  // Update UI based on trigger state
  function updateUIFromTriggerState(activeTriggers) {
    try {
      const triggerToggles = document.querySelectorAll('.trigger-toggle');
      
      triggerToggles.forEach(toggle => {
        const triggerName = toggle.getAttribute('data-trigger');
        if (triggerName) {
          toggle.checked = activeTriggers.includes(triggerName);
        }
      });
    } catch (error) {
      console.error('Error updating UI from trigger state:', error);
    }
  }

  // Sync triggers across pages
  function syncTriggersWithPages(triggerNames, triggerDescriptions) {
    try {
      // First try with bambiSystem
      if (window.bambiSystem) {
        window.bambiSystem.saveState('triggers', {
          activeTriggers: triggerNames,
          triggerDescriptions: triggerDescriptions || {}
        });
      } 
      // Fallback to localStorage
      else {
        localStorage.setItem('bambiActiveTriggers', JSON.stringify(triggerNames));
        if (triggerDescriptions) {
          localStorage.setItem('bambiTriggerDescriptions', JSON.stringify(triggerDescriptions));
        }
      }
      
      // Send to server if socket is available
      if (window.socket && window.socket.connected) {
        window.socket.emit('active-triggers', {
          activeTriggers: triggerNames,
          triggerDetails: triggerNames.map(t => ({
            name: t,
            description: (triggerDescriptions && triggerDescriptions[t]) || ''
          }))
        });
      }
      
      updateUIFromTriggerState(triggerNames);
    } catch (error) {
      console.error('Error in syncTriggersWithPages:', error);
    }
  }

  // Clean up event listeners
  function tearDown() {
    try {
      // Clean up textarea event listeners
      const mainTextarea = document.getElementById('textarea');
      const chatTextarea = document.getElementById('textarea-chat');
      
      if (mainTextarea && eventHandlers.mainTextareaHandler) {
        mainTextarea.removeEventListener("keypress", eventHandlers.mainTextareaHandler);
      }
      
      if (chatTextarea && eventHandlers.chatTextareaHandler) {
        chatTextarea.removeEventListener("keypress", eventHandlers.chatTextareaHandler);
      }
      
      // Remove document event listeners
      if (eventHandlers.triggerStateChanged) {
        document.removeEventListener('trigger-state-changed', eventHandlers.triggerStateChanged);
      }
      
      if (eventHandlers.systemControlsLoaded) {
        document.removeEventListener('system-controls-loaded', eventHandlers.systemControlsLoaded);
      }
      
      console.log('Responsive module event listeners cleaned up');
    } catch (error) {
      console.error('Error during responsive module tearDown:', error);
    }
  }

  // Public API
  return {
    init,
    applyUppercaseStyle,
    styleWordsBetweenPunctuation,
    colorMatchingUsernameResponses,
    syncTriggersWithPages,
    tearDown,
    autoExpand
  };
})();

// Add global access to tearDown
window.tearDownResponsive = function() {
  if (window.responsiveModule) {
    window.responsiveModule.tearDown();
  }
};

// Add global access to syncTriggersWithPages
window.syncTriggersWithPages = function(triggerNames, triggerDescriptions) {
  if (window.responsiveModule) {
    window.responsiveModule.syncTriggersWithPages(triggerNames, triggerDescriptions);
  }
};

// Add global access to autoExpand
window.autoExpand = function(element) {
  if (window.responsiveModule) {
    window.responsiveModule.autoExpand(element);
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.responsiveModule.init);