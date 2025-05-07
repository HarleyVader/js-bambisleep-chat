function autoExpand(element) {
  element.style.height = "inherit";
  const computed = window.getComputedStyle(element);
  const height =
    parseInt(computed.getPropertyValue("border-top-width"), 5) +
    parseInt(computed.getPropertyValue("border-bottom-width"), 5) +
    element.scrollHeight;
  element.style.height = height + "px";
}

// Use different variable names to avoid conflicts
document.addEventListener('DOMContentLoaded', function() {
  // Get both textareas and their respective submit buttons
  const mainTextarea = document.getElementById('textarea');
  const chatTextarea = document.getElementById('textarea-chat');
  const submitBtn = document.getElementById('submit');
  const sendChatBtn = document.getElementById('send');

  // Only add listeners if elements exist
  if (mainTextarea && submitBtn) {
    // Apply Enter key event listener to the main textarea
    mainTextarea.addEventListener("keypress", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submitBtn.click();
      }
    });
  }

  if (chatTextarea && sendChatBtn) {
    // Apply Enter key event listener to the chat textarea
    chatTextarea.addEventListener("keypress", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendChatBtn.click();
      }
    });
  }
  
  // Sync triggers with system controls if available
  syncTriggersWithSystemControls();
});

function applyUppercaseStyle() {
  const responseParagraphs = document.querySelectorAll('#response p');
  responseParagraphs.forEach(paragraph => {
      const text = paragraph.textContent;
      const styledText = text.replace(/([A-Z])/g, '<span class="uppercase-char">$1</span>');
      paragraph.innerHTML = styledText;
  });
}

function styleWordsBetweenPunctuation() {
  const responseParagraphs = document.querySelectorAll('#response p');
  responseParagraphs.forEach(paragraph => {
    let text = paragraph.innerHTML;
    text = text.replace(/"([^"]+)"/g, '<span style="font-style: italic;">"$1"</span>');
    text = text.replace(/\*([^*]+)\*/g, '<span style="font-weight: bold;">*$1*</span>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<span style="font-weight: bold; text-transform: uppercase;">**$1**</span>');
    paragraph.innerHTML = text;
  });
}

function colorMatchingUsernameResponses(profileUsername) {
  const responseParagraphs = document.querySelectorAll('#response p');
  responseParagraphs.forEach(paragraph => {
    if (paragraph.textContent.includes(profileUsername)) {
      paragraph.style.color = 'var(--tertiary-color)';
    }
  });
}

// Function to sync triggers with system controls
function syncTriggersWithSystemControls() {
  // Wait for system controls to be fully loaded
  document.addEventListener('system-controls-loaded', function() {
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
      
      // Store in localStorage for persistence
      localStorage.setItem('bambiActiveTriggers', JSON.stringify(activeTriggers));
      localStorage.setItem('bambiTriggerDescriptions', JSON.stringify(descriptions));
      
      // Send to server if socket is available
      if (typeof window.socket !== 'undefined' && window.socket.connected) {
        window.socket.emit('triggers', {
          triggerNames: activeTriggers.join(','),
          triggerDetails: activeTriggers.map(t => ({ 
            name: t, 
            description: descriptions[t] || '' 
          }))
        });
        
        console.log('Synced triggers with system controls:', activeTriggers);
      }
    }
  });
}

styleWordsBetweenPunctuation();