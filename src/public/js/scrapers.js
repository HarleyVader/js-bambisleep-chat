document.addEventListener('DOMContentLoaded', function() {
  // Form submission handlers
  const forms = document.querySelectorAll('.submit-form form');
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const textarea = this.querySelector('textarea');
      const url = textarea.value.trim();
      const type = this.dataset.type;
      
      if (!url) return;
      
      // Get bambiname from cookie or use default
      const bambiname = getCookie('bambiname') || 'Anonymous Bambi';
      
      // Show loading state
      this.querySelector('button').textContent = 'Processing...';
      this.querySelector('button').disabled = true;
      
      // Submit to API - Fixed path by adding /scrapers prefix
      fetch('/scrapers/api/scraper/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type, bambiname })
      })
      .then(response => response.json())
      .then(data => {
        // Reset form
        textarea.value = '';
        this.querySelector('button').textContent = `Scrape ${type.charAt(0).toUpperCase() + type.slice(1)}`;
        this.querySelector('button').disabled = false;
        
        if (data.success) {
          showNotification('Submission successful! Refresh to see results.', 'success');
          setTimeout(() => window.location.reload(), 2000);
        } else {
          showNotification(`Error: ${data.message}`, 'error');
        }
      })
      .catch(error => {
        showNotification(`Error: ${error.message}`, 'error');
        this.querySelector('button').textContent = `Scrape ${type}`;
        this.querySelector('button').disabled = false;
      });
    });
  });
  
  // Voting functionality
  document.querySelectorAll('.vote-btn').forEach(button => {
    button.addEventListener('click', function() {
      const submissionCard = this.closest('.submission-card');
      const submissionId = submissionCard.dataset.id;
      const voteType = this.dataset.vote;
      
      // Fixed path by adding /scrapers prefix
      fetch(`/scrapers/api/scraper/vote/${submissionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: voteType })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          submissionCard.querySelector('.upvote span').textContent = data.upvotes;
          submissionCard.querySelector('.downvote span').textContent = data.downvotes;
          
          if (data.deleted) {
            submissionCard.style.opacity = '0';
            setTimeout(() => submissionCard.remove(), 500);
            showNotification('Submission deleted due to downvotes', 'info');
          } else {
            showNotification('Vote recorded!', 'success');
          }
        }
      })
      .catch(error => showNotification(`Error: ${error.message}`, 'error'));
    });
  });
  
  // Helper functions
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  }
  
  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '4px';
    notification.style.color = 'white';
    notification.style.fontWeight = 'bold';
    notification.style.zIndex = '9999';
    
    // Set background color based on type
    if (type === 'success') notification.style.backgroundColor = '#28a745';
    else if (type === 'error') notification.style.backgroundColor = '#dc3545';
    else if (type === 'info') notification.style.backgroundColor = '#17a2b8';
    else notification.style.backgroundColor = '#007bff';
    
    document.body.appendChild(notification);
    setTimeout(() => document.body.removeChild(notification), 3000);
  }
});