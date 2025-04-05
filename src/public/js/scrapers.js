// Client-side JavaScript for the scrapers page

document.addEventListener('DOMContentLoaded', function() {
  // Form submission handling
  const scraperForms = document.querySelectorAll('form[data-type]');
  scraperForms.forEach(form => {
    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      
      const scrapeType = this.getAttribute('data-type');
      const urlInput = this.querySelector('textarea');
      const url = urlInput.value.trim();
      
      if (!url) {
        alert('Please enter a URL to scrape');
        return;
      }
      
      try {
        const submitButton = this.querySelector('button');
        submitButton.disabled = true;
        submitButton.textContent = 'Scraping...';
        
        const response = await fetch('/scrapers/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            scrapeType
          }),
        });
        
        const result = await response.json();
        
        if (result.success) {
          alert(`Scraping request submitted! The ${scrapeType} scraper will process your URL.`);
          urlInput.value = '';
          // Auto-refresh to show the new submission
          setTimeout(() => {
            location.reload();
          }, 1000);
        } else {
          alert(`Error: ${result.error}`);
        }
      } catch (error) {
        console.error('Error submitting scrape request:', error);
        alert('Error submitting scrape request. Please try again.');
      } finally {
        const submitButton = this.querySelector('button');
        submitButton.disabled = false;
        submitButton.textContent = `Scrape ${scrapeType.charAt(0).toUpperCase() + scrapeType.slice(1)}${scrapeType === 'image' ? 's' : scrapeType === 'video' ? 's' : ''}`;
      }
    });
  });
  
  // Vote buttons handling
  const voteButtons = document.querySelectorAll('.vote-btn');
  voteButtons.forEach(button => {
    button.addEventListener('click', async function() {
      const submissionId = this.closest('.submission-card').getAttribute('data-id');
      const voteType = this.getAttribute('data-vote');
      
      try {
        const response = await fetch(`/scrapers/vote/${submissionId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            voteType
          }),
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Update vote counts in UI
          const upvoteSpan = this.closest('.submission-actions').querySelector('.upvote span');
          const downvoteSpan = this.closest('.submission-actions').querySelector('.downvote span');
          
          upvoteSpan.textContent = result.upvotes;
          downvoteSpan.textContent = result.downvotes;
        } else {
          alert(`Error: ${result.error}`);
        }
      } catch (error) {
        console.error('Error submitting vote:', error);
        alert('Error submitting vote. Please try again.');
      }
    });
  });
  
  // Comment handling
  let currentSubmissionId = null;
  const modal = document.getElementById('comment-modal');
  const closeBtn = document.querySelector('.close-btn');
  const commentButtons = document.querySelectorAll('.comment-btn');
  const commentForm = document.getElementById('comment-form');
  
  // Open modal when comment button clicked
  commentButtons.forEach(button => {
    button.addEventListener('click', async function() {
      currentSubmissionId = this.closest('.submission-card').getAttribute('data-id');
      
      try {
        // Fetch submission details including comments
        const response = await fetch(`/scrapers/detail/${currentSubmissionId}`);
        const submission = await response.json();
        
        // Populate comments container
        const commentsContainer = document.getElementById('comments-container');
        commentsContainer.innerHTML = '';
        
        if (submission.comments && submission.comments.length > 0) {
          submission.comments.forEach(comment => {
            const commentEl = document.createElement('div');
            commentEl.className = 'comment-item';
            
            const commentHeader = document.createElement('div');
            commentHeader.className = 'comment-header';
            
            const bambiName = document.createElement('span');
            bambiName.className = 'bambi-name';
            bambiName.textContent = comment.bambiname;
            
            const commentDate = document.createElement('span');
            commentDate.className = 'comment-date';
            commentDate.textContent = new Date(comment.date).toLocaleString();
            
            commentHeader.appendChild(bambiName);
            commentHeader.appendChild(commentDate);
            
            const commentText = document.createElement('div');
            commentText.className = 'comment-text';
            commentText.textContent = comment.comment;
            
            commentEl.appendChild(commentHeader);
            commentEl.appendChild(commentText);
            
            commentsContainer.appendChild(commentEl);
          });
        } else {
          commentsContainer.innerHTML = '<p class="no-comments">No comments yet</p>';
        }
        
        // Show modal
        modal.style.display = 'block';
      } catch (error) {
        console.error('Error fetching comments:', error);
        alert('Error loading comments. Please try again.');
      }
    });
  });
  
  // Close modal when close button clicked
  closeBtn.addEventListener('click', function() {
    modal.style.display = 'none';
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  // Submit comment form
  commentForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const commentText = document.getElementById('comment-text').value.trim();
    
    if (!commentText) {
      alert('Please enter a comment');
      return;
    }
    
    try {
      const response = await fetch(`/scrapers/comment/${currentSubmissionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: commentText
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update comments in UI
        const commentsContainer = document.getElementById('comments-container');
        commentsContainer.innerHTML = '';
        
        result.comments.forEach(comment => {
          const commentEl = document.createElement('div');
          commentEl.className = 'comment-item';
          
          const commentHeader = document.createElement('div');
          commentHeader.className = 'comment-header';
          
          const bambiName = document.createElement('span');
          bambiName.className = 'bambi-name';
          bambiName.textContent = comment.bambiname;
          
          const commentDate = document.createElement('span');
          commentDate.className = 'comment-date';
          commentDate.textContent = new Date(comment.date).toLocaleString();
          
          commentHeader.appendChild(bambiName);
          commentHeader.appendChild(commentDate);
          
          const commentText = document.createElement('div');
          commentText.className = 'comment-text';
          commentText.textContent = comment.comment;
          
          commentEl.appendChild(commentHeader);
          commentEl.appendChild(commentText);
          
          commentsContainer.appendChild(commentEl);
        });
        
        // Update comment count on the submission card
        const submissionCard = document.querySelector(`.submission-card[data-id="${currentSubmissionId}"]`);
        const commentCountSpan = submissionCard.querySelector('.comment-btn span');
        commentCountSpan.textContent = result.comments.length;
        
        // Clear comment form
        document.getElementById('comment-text').value = '';
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Error submitting comment. Please try again.');
    }
  });
});