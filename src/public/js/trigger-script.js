document.addEventListener('DOMContentLoaded', function() {
  // Initialize socket connection
  const socket = io();
  const username = document.body.getAttribute('data-username');
  
  // Start session button
  const startButton = document.getElementById('start-session');
  if (startButton) {
    startButton.addEventListener('click', function() {
      // Send selected triggers to server before redirecting
      const triggerItems = document.querySelectorAll('.trigger-item.selected');
      const selectedTriggers = Array.from(triggerItems).map(item => {
        return {
          name: item.querySelector('.trigger-name').textContent,
          description: item.querySelector('.trigger-description').textContent
        };
      });
      
      // Send triggers to the server
      socket.emit('set-triggers', {
        triggerDetails: selectedTriggers,
        triggerNames: selectedTriggers.map(t => t.name).join(',')
      });
      
      // Wait briefly for the socket emission to complete
      setTimeout(() => {
        window.location.href = '/';
      }, 300);
    });
  }
  
  // Make trigger items selectable
  const triggerItems = document.querySelectorAll('.trigger-item');
  triggerItems.forEach(item => {
    // Mark all as selected by default
    item.classList.add('selected');
    
    item.addEventListener('click', function() {
      // Toggle selection
      this.classList.toggle('selected');
      
      // Add highlight effect
      this.classList.add('highlight');
      setTimeout(() => this.classList.remove('highlight'), 500);
    });
  });
});