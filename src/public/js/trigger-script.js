document.addEventListener('DOMContentLoaded', function() {
  // Start session button
  const startButton = document.getElementById('start-session');
  if (startButton) {
    startButton.addEventListener('click', function() {
      window.location.href = '/';
    });
  }
  
  // Make trigger items clickable
  const triggerItems = document.querySelectorAll('.trigger-item');
  triggerItems.forEach(item => {
    item.addEventListener('click', function() {
      // Add highlight effect
      this.classList.add('highlight');
      setTimeout(() => this.classList.remove('highlight'), 500);
    });
  });
});