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

import { getSocket } from './socket-client.js';

const socket = getSocket('/bambis'); // Pass namespace as parameter if needed

document.addEventListener('DOMContentLoaded', () => {
  // Set up socket events
  socket.on('connect', () => {
    console.log('Connected to bambi namespace');
  });
  
  socket.on('profile-updated', (data) => {
    console.log('Profile updated:', data);
    // Refresh the page if current profile was updated
    const currentProfile = document.querySelector('.current-profile');
    if (currentProfile && currentProfile.dataset.username === data.username) {
      window.location.reload();
    }
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from bambis socket');
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
    // Show error message to user
    const errorContainer = document.createElement('div');
    errorContainer.classList.add('error-message');
    errorContainer.textContent = error.message || 'An error occurred';
    document.body.appendChild(errorContainer);
    
    // Remove after 5 seconds
    setTimeout(() => {
      errorContainer.remove();
    }, 5000);
  });
});