document.addEventListener('DOMContentLoaded', function () {
    // Get DOM elements
    const contentModal = document.getElementById('content-modal');
    const contentContainer = document.getElementById('content-container');
    const contentTitle = document.getElementById('content-modal-title');
    const contentUrl = document.getElementById('content-url');
    const contentStatus = document.getElementById('content-status');
    const closeContentBtn = document.querySelector('.content-close-btn');

    // Initialize content modal structure if needed
    if (!document.getElementById('content-modal-title')) {
        const titleEl = document.createElement('h3');
        titleEl.id = 'content-modal-title';
        titleEl.textContent = 'Content';
        document.querySelector('.content-modal-content').appendChild(titleEl);
    }

    if (!document.getElementById('content-url')) {
        const headerEl = document.createElement('div');
        headerEl.className = 'content-modal-header';

        const urlEl = document.createElement('div');
        urlEl.id = 'content-url';
        urlEl.className = 'content-url';

        const statusEl = document.createElement('div');
        statusEl.id = 'content-status';
        statusEl.className = 'content-status';

        headerEl.appendChild(urlEl);
        headerEl.appendChild(statusEl);

        document.querySelector('.content-modal-content').appendChild(headerEl);
    }

    if (!document.getElementById('content-container')) {
        const containerEl = document.createElement('div');
        containerEl.id = 'content-container';
        containerEl.className = 'content-container';
        document.querySelector('.content-modal-content').appendChild(containerEl);
    }

    // Close modal when clicking the close button
    if (closeContentBtn) {
        closeContentBtn.addEventListener('click', function () {
            contentModal.style.display = 'none';
        });
    }

    // Close modal when clicking outside the modal
    window.addEventListener('click', function (event) {
        if (event.target === contentModal) {
            contentModal.style.display = 'none';
        }
    });

    // Add event listeners to view content buttons
    document.querySelectorAll('.view-content-btn').forEach(button => {
        button.addEventListener('click', function () {
            const submissionCard = this.closest('.submission-card');
            const submissionId = submissionCard.dataset.id;
            const contentType = this.dataset.type;

            // Get fresh references to modal elements
            const modalTitle = document.getElementById('content-modal-title');
            const modalUrl = document.getElementById('content-url');
            const modalStatus = document.getElementById('content-status');
            const modal = document.getElementById('content-modal');

            // Set modal title based on content type
            if (modalTitle) modalTitle.textContent = contentType.charAt(0).toUpperCase() + contentType.slice(1) + ' Content';

            // Set URL and status
            const urlElement = submissionCard.querySelector('.submission-url');
            const statusElement = submissionCard.querySelector('.submission-status');
            
            if (modalUrl) modalUrl.textContent = urlElement.textContent.trim();
            if (modalStatus) {
                modalStatus.textContent = statusElement.textContent.trim();
                modalStatus.className = 'content-status ' + statusElement.classList[1];
            }

            // Fetch and display content
            fetchScrapedContent(submissionId, contentType);

            // Show modal
            if (modal) modal.style.display = 'block';
        });
    });

    // Share button functionality
    document.querySelectorAll('.share-btn').forEach(button => {
        button.addEventListener('click', function () {
            const submissionId = this.dataset.id;
            const contentType = this.dataset.type;

            // Create a shareable URL
            const shareUrl = `${window.location.origin}/scrapers?view=${submissionId}&type=${contentType}`;

            // Create a temporary input element to copy to clipboard
            const tempInput = document.createElement('input');
            tempInput.value = shareUrl;
            document.body.appendChild(tempInput);

            // Select and copy the URL
            tempInput.select();
            document.execCommand('copy');

            // Clean up
            document.body.removeChild(tempInput);

            // Show notification
            showShareNotification('Link copied to clipboard!');
        });
    });

    // Function to fetch scraped content
    function fetchScrapedContent(submissionId, contentType) {
        // Get a fresh reference to the content container
        const contentContainerEl = document.getElementById('content-container');
        
        // Create content container if it doesn't exist
        if (!contentContainerEl) {
            const containerEl = document.createElement('div');
            containerEl.id = 'content-container';
            containerEl.className = 'content-container';
            document.querySelector('.content-modal-content').appendChild(containerEl);
        }
        
        // Get a fresh reference again after possible creation
        const container = document.getElementById('content-container');
        
        // Show loading state
        if (container) {
            container.innerHTML = '<div class="loading">Loading content...</div>';
        } else {
            console.error('Content container not found even after attempting to create it');
            return;
        }

        // Fetch content from server
        fetch(`/api/scraper/submission/${submissionId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load content (Status: ${response.status})`);
                }
                return response.json();
            })
            .then(data => {
                displayContent(data, contentType);
            })
            .catch(error => {
                if (container) {
                    container.innerHTML = `<div class="error">
                        <p>${error.message}</p>
                        <p>The API endpoint may not be configured correctly. Please check:</p>
                        <ul style="margin-top: 1vh; margin-left: 2vw; text-align: left;">
                            <li>Backend route is properly set up</li>
                            <li>Submission ID is valid</li>
                            <li>You have permission to access this content</li>
                        </ul>
                    </div>`;
                }
                console.error('Content loading error:', error);
            });
    }

    // Function to display content based on type
    function displayContent(data, contentType) {
        console.log('Content data received:', data);
        
        // Get fresh reference to content container
        const container = document.getElementById('content-container');
        if (!container) {
            console.error('Content container not found in displayContent function');
            return;
        }
        
        // Check if data was returned successfully
        if (!data || !data.success) {
            container.innerHTML = '<div class="content-not-found">Failed to retrieve content</div>';
            return;
        }

        // Debug info display
        if (data.debug) {
            console.log('Debug info:', data.debug);
        }

        // Check if results exist for the specified content type
        if (!data.results || !data.results[contentType]) {
            container.innerHTML = `
                <div class="content-not-found">
                    <p>No content available for this submission</p>
                    <p class="debug-info">Type: ${contentType}, Status: ${data.debug?.status || 'unknown'}</p>
                </div>`;
            return;
        }

        const result = data.results[contentType];

        if (!result.contentFound) {
            container.innerHTML = '<div class="content-not-found">No BambiSleep content found on this page</div>';
            return;
        }

        let contentHtml = '';

        switch (contentType) {
            case 'text':
                contentHtml = `<div class="text-content">${formatTextContent(result.content)}</div>`;
                break;
            case 'image':
                contentHtml = '<div class="image-content">';
                if (Array.isArray(result.content)) {
                    if (result.content.length === 0) {
                        contentHtml += '<p class="content-not-found">No images found</p>';
                    } else {
                        result.content.forEach(img => {
                            contentHtml += `
                            <figure>
                                <img src="${img.url}" alt="${img.alt || 'BambiSleep image'}" />
                                ${img.caption ? `<figcaption>${img.caption}</figcaption>` : ''}
                            </figure>
                        `;
                        });
                    }
                } else {
                    contentHtml += '<p>Image data has unexpected format</p>';
                }
                contentHtml += '</div>';
                break;
            case 'video':
                contentHtml = '<div class="video-content">';
                if (Array.isArray(result.content)) {
                    if (result.content.length === 0) {
                        contentHtml += '<p class="content-not-found">No videos found</p>';
                    } else {
                        result.content.forEach(video => {
                            if (video.embedUrl) {
                                contentHtml += `
                                    <div class="video-container">
                                        <iframe src="${video.embedUrl}" frameborder="0" allowfullscreen></iframe>
                                        ${video.title ? `<h4>${video.title}</h4>` : ''}
                                    </div>
                                `;
                            } else if (video.url) {
                                contentHtml += `
                                    <div class="video-container">
                                        <video controls src="${video.url}"></video>
                                        ${video.title ? `<h4>${video.title}</h4>` : ''}
                                    </div>
                                `;
                            }
                        });
                    }
                } else {
                    contentHtml += '<p>Video data has unexpected format</p>';
                }
                contentHtml += '</div>';
                break;
        }

        container.innerHTML = contentHtml;
    }

    // Format text content with proper escaping and line breaks
    function formatTextContent(text) {
        const escaped = escapeHtml(text);
        return escaped.replace(/\n/g, '<br>');
    }

    // Helper function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Function to show share notification
    function showShareNotification(message) {
        // Check if notification already exists
        let notification = document.querySelector('.share-notification');

        // Create notification if it doesn't exist
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'share-notification';
            document.body.appendChild(notification);
        }

        // Set message and show
        notification.textContent = message;
        notification.style.display = 'block';

        // Hide after 2 seconds
        setTimeout(() => {
            notification.style.display = 'none';
        }, 2000);
    }

    // Handle URL parameters for direct viewing of shared content
    function handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const viewId = urlParams.get('view');
        const contentType = urlParams.get('type');
        
        if (viewId && contentType) {
            // Find the submission with matching ID
            const submissionCard = document.querySelector(`.submission-card[data-id="${viewId}"]`);
            
            if (submissionCard) {
                // Trigger view content button click
                submissionCard.querySelector('.view-content-btn').click();
            } else {
                // Get fresh references to elements
                const contentTitleEl = document.getElementById('content-modal-title');
                const contentUrlEl = document.getElementById('content-url');
                const contentStatusEl = document.getElementById('content-status');
                const contentModalEl = document.getElementById('content-modal');
                
                // If card not found in current view, fetch and display content directly
                if (contentTitleEl) contentTitleEl.textContent = contentType.charAt(0).toUpperCase() + contentType.slice(1) + ' Content';
                if (contentUrlEl) contentUrlEl.textContent = 'Shared Content';
                if (contentStatusEl) {
                    contentStatusEl.textContent = 'shared';
                    contentStatusEl.className = 'content-status';
                }
                
                fetchScrapedContent(viewId, contentType);
                if (contentModalEl) contentModalEl.style.display = 'block';
            }
        }
    }

    // Call the URL parameter handler when page loads
    handleUrlParameters();
});