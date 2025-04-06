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
      
      // Submit to API
      fetch('/api/scraper/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url, type, bambiname })
      })
      .then(response => response.json())
      .then(data => {
        // Reset form
        textarea.value = '';
        this.querySelector('button').textContent = `Scrape ${type.charAt(0).toUpperCase() + type.slice(1)}${type === 'image' ? 's' : ''}`;
        this.querySelector('button').disabled = false;
        
        if (data.success) {
          showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} scraping submitted successfully!`, 'success');
          // Refresh the page after 2 seconds to show the new submission
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          showNotification(`Error: ${data.message}`, 'error');
        }
      })
      .catch(error => {
        showNotification(`Error: ${error.message}`, 'error');
        this.querySelector('button').textContent = `Scrape ${type.charAt(0).toUpperCase() + type.slice(1)}${type === 'image' ? 's' : ''}`;
        this.querySelector('button').disabled = false;
      });
    });
  });
  
  // Voting functionality
  const voteButtons = document.querySelectorAll('.vote-btn');
  voteButtons.forEach(button => {
    button.addEventListener('click', function() {
      const submissionCard = this.closest('.submission-card');
      const submissionId = submissionCard.dataset.id;
      const voteType = this.dataset.vote;
      
      fetch(`/api/scraper/vote/${submissionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vote: voteType })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          if (data.deleted) {
            // Remove the card with a fade out effect
            submissionCard.style.opacity = '0';
            submissionCard.style.transition = 'opacity 0.5s ease';
            setTimeout(() => {
              submissionCard.remove();
            }, 500);
            showNotification('Submission deleted due to 10 or more downvotes', 'info');
          } else {
            // Update vote counts
            submissionCard.querySelector('.upvote span').textContent = data.upvotes;
            submissionCard.querySelector('.downvote span').textContent = data.downvotes;
            showNotification('Vote recorded!', 'success');
          }
        } else {
          showNotification(`Error: ${data.message}`, 'error');
        }
      })
      .catch(error => {
        showNotification(`Error: ${error.message}`, 'error');
      });
    });
  });
  
  // Comments modal functionality
  const commentModal = document.getElementById('comment-modal');
  const commentForm = document.getElementById('comment-form');
  const commentsContainer = document.getElementById('comments-container');
  const closeBtn = document.querySelector('.close-btn');
  let currentSubmissionId = null;
  
  // Open comments modal
  document.querySelectorAll('.comment-btn').forEach(button => {
    button.addEventListener('click', function() {
      const submissionCard = this.closest('.submission-card');
      currentSubmissionId = submissionCard.dataset.id;
      
      // Fetch comments
      fetch(`/api/scraper/comments/${currentSubmissionId}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Display comments
            displayComments(data.comments);
            commentModal.style.display = 'block';
          } else {
            showNotification(`Error: ${data.message}`, 'error');
          }
        })
        .catch(error => {
          showNotification(`Error: ${error.message}`, 'error');
        });
    });
  });
  
  // Close modal
  closeBtn.addEventListener('click', function() {
    commentModal.style.display = 'none';
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === commentModal) {
      commentModal.style.display = 'none';
    }
  });
  
  // Submit comment
  commentForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const commentText = document.getElementById('comment-text').value.trim();
    if (!commentText || !currentSubmissionId) return;
    
    // Get bambiname from cookie or use default
    const bambiname = getCookie('bambiname') || 'Anonymous Bambi';
    
    fetch(`/api/scraper/comment/${currentSubmissionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: commentText, bambiname })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Clear form and update comments
        document.getElementById('comment-text').value = '';
        displayComments(data.comments);
        
        // Update comment count on the submission card
        const submissionCard = document.querySelector(`.submission-card[data-id="${currentSubmissionId}"]`);
        if (submissionCard) {
          const commentCountEl = submissionCard.querySelector('.comment-btn span');
          commentCountEl.textContent = data.comments.length;
        }
        
        showNotification('Comment added!', 'success');
      } else {
        showNotification(`Error: ${data.message}`, 'error');
      }
    })
    .catch(error => {
      showNotification(`Error: ${error.message}`, 'error');
    });
  });
  
  // Helper function to display comments
  function displayComments(comments) {
    if (!comments || comments.length === 0) {
      commentsContainer.innerHTML = '<p class="no-comments">No comments yet</p>';
      return;
    }
    
    commentsContainer.innerHTML = '';
    comments.forEach(comment => {
      const commentEl = document.createElement('div');
      commentEl.className = 'comment-item';
      
      const commentHeader = document.createElement('div');
      commentHeader.className = 'comment-header';
      commentHeader.innerHTML = `
        <span class="bambi-name">${comment.bambiname || 'Anonymous Bambi'}</span>
        <span class="comment-date">${new Date(comment.date).toLocaleString()}</span>
      `;
      
      const commentText = document.createElement('div');
      commentText.className = 'comment-text';
      commentText.textContent = comment.text;
      
      commentEl.appendChild(commentHeader);
      commentEl.appendChild(commentText);
      commentsContainer.appendChild(commentEl);
    });
  }
  
  // Helper function to get cookie
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  }
  
  // Notification function
  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Position notification
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '4px';
    notification.style.color = 'white';
    notification.style.fontWeight = 'bold';
    notification.style.zIndex = '9999';
    
    // Set background color based on type
    if (type === 'success') {
      notification.style.backgroundColor = '#28a745';
    } else if (type === 'error') {
      notification.style.backgroundColor = '#dc3545';
    } else if (type === 'info') {
      notification.style.backgroundColor = '#17a2b8';
    } else {
      notification.style.backgroundColor = '#007bff';
    }
    
    // Remove notification after 3 seconds
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  }
});