window.scrapersView = (function() {
    // Private variables
    const _timeouts = [];
    let _modalClickHandler;
    
    // Override setTimeout to track IDs for cleanup
    const originalSetTimeout = window.setTimeout;
    window.setTimeout = function(callback, delay) {
        const timeoutId = originalSetTimeout(callback, delay);
        if (_timeouts) {
            _timeouts.push(timeoutId);
        }
        return timeoutId;
    };
    
    // Initialize content modal structure if needed
    function _initModalStructure() {
        try {
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
        } catch (error) {
            console.error('Error initializing modal structure:', error);
        }
    }

    // Add event listeners
    function _setupEventListeners() {
        try {
            const contentModal = document.getElementById('content-modal');
            const closeContentBtn = document.querySelector('.content-close-btn');
            
            // Modal close button
            if (closeContentBtn) {
                closeContentBtn._clickHandler = function() {
                    contentModal.style.display = 'none';
                };
                closeContentBtn.addEventListener('click', closeContentBtn._clickHandler);
            }
            
            // Modal outside click
            _modalClickHandler = function(event) {
                if (event.target === contentModal) {
                    contentModal.style.display = 'none';
                }
            };
            window.addEventListener('click', _modalClickHandler);
            
            // View content buttons
            document.querySelectorAll('.view-content-btn').forEach(button => {
                button._clickHandler = function() {
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
                };
                button.addEventListener('click', button._clickHandler);
            });
            
            // Share buttons
            document.querySelectorAll('.share-btn').forEach(button => {
                button._clickHandler = function() {
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
                };
                button.addEventListener('click', button._clickHandler);
            });
        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }

    // Function to fetch scraped content
    function fetchScrapedContent(submissionId, contentType) {
        // Get fresh reference to container
        const container = document.getElementById('content-container') || 
            document.querySelector('.content-modal-content').appendChild(document.createElement('div'));
        
        // Show loading state
        container.innerHTML = '<div class="loading">Loading content...</div>';

        // Fetch from server
        fetch(`/scrapers/api/scraper/submission/${submissionId}`)
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
                container.innerHTML = `<div class="error">
                    <p>${error.message}</p>
                    <p>The API endpoint may not be configured correctly.</p>
                </div>`;
                console.error('Content loading error:', error);
            });
    }

    // Function to display content based on type
    function displayContent(data, contentType) {
        const container = document.getElementById('content-container');
        if (!container) return;
        
        // Check if data was returned successfully
        if (!data || !data.success) {
            container.innerHTML = '<div class="content-not-found">Failed to retrieve content</div>';
            return;
        }

        // Check if job failed
        if (data.debug && data.debug.status === 'failed') {
            container.innerHTML = `
                <div class="content-not-found">
                    <h3>Scraping job failed</h3>
                    <p>The ${contentType} scraping job did not complete successfully.</p>
                </div>`;
            return;
        }

        // Check if results exist
        if (!data.results || !data.results[contentType]) {
            container.innerHTML = `
                <div class="content-not-found">
                    <p>No content available for this submission</p>
                </div>`;
            return;
        }

        const result = data.results[contentType];

        if (!result.contentFound && (!result.content || result.content.length === 0)) {
            container.innerHTML = '<div class="content-not-found">No BambiSleep content found on this page</div>';
            return;
        }

        let contentHtml = '';

        switch (contentType) {
            case 'text':
                contentHtml = !result.content ? 
                    '<div class="content-not-found">No text content was extracted from this page</div>' : 
                    `<div class="text-content">${formatTextContent(result.content)}</div>`;
                break;
                
            case 'image':
                contentHtml = '<div class="image-content">';
                if (!Array.isArray(result.content) || result.content.length === 0) {
                    contentHtml += '<p class="content-not-found">No images found</p>';
                } else {
                    result.content.forEach(img => {
                        if (typeof img === 'object' && img.url) {
                            contentHtml += `
                            <figure>
                                <img src="${img.url}" alt="${img.metadata?.description || 'BambiSleep image'}" />
                                <figcaption>${img.metadata?.description || ''}</figcaption>
                            </figure>`;
                        }
                    });
                }
                contentHtml += '</div>';
                break;
                
            case 'video':
                contentHtml = '<div class="video-content">';
                if (!Array.isArray(result.content) || result.content.length === 0) {
                    contentHtml += '<p class="content-not-found">No videos found</p>';
                } else {
                    result.content.forEach(video => {
                        if (video.embedUrl) {
                            contentHtml += `
                                <div class="video-container">
                                    <iframe src="${video.embedUrl}" frameborder="0" allowfullscreen></iframe>
                                    ${video.title ? `<h4>${video.title}</h4>` : ''}
                                </div>`;
                        } else if (video.url) {
                            contentHtml += `
                                <div class="video-container">
                                    <video controls src="${video.url}"></video>
                                    ${video.title ? `<h4>${video.title}</h4>` : ''}
                                </div>`;
                        }
                    });
                }
                contentHtml += '</div>';
                break;
        }

        container.innerHTML = contentHtml;
    }

    // Format text content with markdown conversion
    function formatTextContent(text) {
        const escapedText = escapeHtml(text);
        
        return escapedText
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
            .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1">')
            .replace(/^- (.+)$/gm, '<li>$1</li>').replace(/(<li>.+<\/li>\n)+/g, '<ul>$&</ul>')
            .replace(/^\d+\. (.+)$/gm, '<li>$1</li>').replace(/(<li>.+<\/li>\n)+/g, '<ol>$&</ol>')
            .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
            .replace(/^([^\n<][^\n]+)(?:\n{2,})/gm, '<p>$1</p>')
            .replace(/\n/g, '<br>');
    }

    // Helper to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show share notification
    function showShareNotification(message) {
        let notification = document.querySelector('.share-notification');

        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'share-notification';
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.style.display = 'block';

        const timeoutId = setTimeout(() => {
            notification.style.display = 'none';
        }, 2000);
        _timeouts.push(timeoutId);
    }

    // Handle URL parameters for shared content
    function handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const viewId = urlParams.get('view');
        const contentType = urlParams.get('type');
        
        if (!viewId || !contentType) return;
        
        const submissionCard = document.querySelector(`.submission-card[data-id="${viewId}"]`);
        
        if (submissionCard) {
            submissionCard.querySelector('.view-content-btn').click();
        } else {
            const contentTitleEl = document.getElementById('content-modal-title');
            const contentUrlEl = document.getElementById('content-url');
            const contentStatusEl = document.getElementById('content-status');
            const contentModalEl = document.getElementById('content-modal');
            
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
    
    // Clean up all event listeners and timeouts
    function tearDown() {
        try {
            // Clean up content modal close button
            const closeContentBtn = document.querySelector('.content-close-btn');
            if (closeContentBtn && closeContentBtn._clickHandler) {
                closeContentBtn.removeEventListener('click', closeContentBtn._clickHandler);
                delete closeContentBtn._clickHandler;
            }
            
            // Clean up modal outside click handler
            if (_modalClickHandler) {
                window.removeEventListener('click', _modalClickHandler);
                _modalClickHandler = null;
            }
            
            // Clean up view content buttons
            document.querySelectorAll('.view-content-btn').forEach(button => {
                if (button._clickHandler) {
                    button.removeEventListener('click', button._clickHandler);
                    delete button._clickHandler;
                }
            });
            
            // Clean up share buttons
            document.querySelectorAll('.share-btn').forEach(button => {
                if (button._clickHandler) {
                    button.removeEventListener('click', button._clickHandler);
                    delete button._clickHandler;
                }
            });
            
            // Remove notification elements
            const notification = document.querySelector('.share-notification');
            if (notification && notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            
            // Clear timeouts
            _timeouts.forEach(clearTimeout);
            _timeouts.length = 0;
            
            console.log('Scrapers view cleaned up');
        } catch (error) {
            console.error('Error during scrapers view tearDown:', error);
        }
    }

    // Initialize module
    function init() {
        _initModalStructure();
        _setupEventListeners();
        handleUrlParameters();
    }

    // Public API
    return {
        init,
        tearDown,
        fetchContent: fetchScrapedContent
    };
})();

// Add global access to tearDown
window.tearDownScrapersView = function() {
    if (window.scrapersView) {
        window.scrapersView.tearDown();
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.scrapersView.init);