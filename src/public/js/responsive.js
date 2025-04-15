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

styleWordsBetweenPunctuation();