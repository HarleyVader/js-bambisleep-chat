/**
 * Converts URLs in text to clickable links
 * @param {string} text - The text to process
 * @returns {string} HTML with clickable links
 */
function makeLinksClickable(text) {
  if (!text) return '';
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

// Make this function available globally
window.makeLinksClickable = makeLinksClickable;