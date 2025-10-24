// error-manager.js - Centralized error handling and user feedback system
class ErrorManager {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 50;
        this.errorDisplayTimeout = null;
        this.retryAttempts = new Map(); // Track retry attempts per service
        this.maxRetries = 3;

        this.init();
    }

    init() {
        this.createErrorUI();
        this.setupGlobalErrorHandler();
        console.log('✅ Error Management System initialized');
    }

    // Create error notification UI
    createErrorUI() {
        // Create error container if it doesn't exist
        if (!document.getElementById('error-container')) {
            const errorContainer = document.createElement('div');
            errorContainer.id = 'error-container';
            errorContainer.className = 'error-container';
            errorContainer.innerHTML = `
                <div id="error-notification" class="error-notification hidden">
                    <div class="error-content">
                        <div class="error-icon">⚠️</div>
                        <div class="error-text">
                            <div class="error-title"></div>
                            <div class="error-message"></div>
                        </div>
                        <div class="error-actions">
                            <button class="error-retry hidden">Retry</button>
                            <button class="error-dismiss">Dismiss</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(errorContainer);

            // Add CSS styles
            this.addErrorStyles();
            this.setupErrorEventHandlers();
        }
    }

    addErrorStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .error-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
            }

            .error-notification {
                background: linear-gradient(135deg, #ff4757, #ff3742);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3);
                color: white;
                min-width: 300px;
                max-width: 400px;
                padding: 16px;
                margin-bottom: 10px;
                transform: translateX(100%);
                transition: transform 0.3s ease-in-out;
                pointer-events: auto;
                border-left: 4px solid #ff1744;
            }

            .error-notification.show {
                transform: translateX(0);
            }

            .error-notification.hidden {
                display: none;
            }

            .error-notification.warning {
                background: linear-gradient(135deg, #ffa726, #ff9800);
                border-left-color: #f57c00;
                box-shadow: 0 4px 12px rgba(255, 167, 38, 0.3);
            }

            .error-notification.info {
                background: linear-gradient(135deg, #42a5f5, #2196f3);
                border-left-color: #1976d2;
                box-shadow: 0 4px 12px rgba(66, 165, 245, 0.3);
            }

            .error-content {
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }

            .error-icon {
                font-size: 24px;
                line-height: 1;
            }

            .error-text {
                flex: 1;
            }

            .error-title {
                font-weight: bold;
                font-size: 14px;
                margin-bottom: 4px;
            }

            .error-message {
                font-size: 13px;
                opacity: 0.9;
                line-height: 1.4;
            }

            .error-actions {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }

            .error-actions button {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: background 0.2s;
            }

            .error-actions button:hover {
                background: rgba(255, 255, 255, 0.3);
            }

            .error-actions button.hidden {
                display: none;
            }
        `;
        document.head.appendChild(style);
    }

    setupErrorEventHandlers() {
        const notification = document.getElementById('error-notification');
        const dismissBtn = notification.querySelector('.error-dismiss');
        const retryBtn = notification.querySelector('.error-retry');

        dismissBtn.addEventListener('click', () => this.hideError());
        retryBtn.addEventListener('click', () => {
            if (this.currentErrorContext && this.currentErrorContext.retryAction) {
                this.currentErrorContext.retryAction();
            }
            this.hideError();
        });
    }

    setupGlobalErrorHandler() {
        // Catch unhandled JavaScript errors
        window.addEventListener('error', (event) => {
            this.logError('JavaScript Error', {
                message: event.message,
                filename: event.filename,
                line: event.lineno,
                column: event.colno,
                stack: event.error?.stack
            });
        });

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Unhandled Promise Rejection', {
                reason: event.reason,
                promise: event.promise
            });
        });
    }

    // Main error reporting method
    reportError(service, type, details = {}) {
        const errorContext = {
            service,
            type,
            details,
            timestamp: new Date().toISOString(),
            retryCount: this.getRetryCount(service, type)
        };

        this.logError(type, errorContext);
        this.handleErrorResponse(errorContext);
    }

    // Handle different types of errors with appropriate responses
    handleErrorResponse(errorContext) {
        const { service, type, details } = errorContext;

        switch (service) {
            case 'ai-chat':
                this.handleAIChatError(type, details, errorContext);
                break;
            case 'tts':
                this.handleTTSError(type, details, errorContext);
                break;
            case 'socket':
                this.handleSocketError(type, details, errorContext);
                break;
            case 'api':
                this.handleAPIError(type, details, errorContext);
                break;
            default:
                this.handleGenericError(type, details, errorContext);
        }
    }

    handleAIChatError(type, details, context) {
        const retryAction = () => {
            if (details.retryCallback) details.retryCallback();
        };

        switch (type) {
            case 'worker_unavailable':
                this.showError('AI Chat Unavailable',
                    'The AI service is currently not configured. Please check your LM Studio settings.',
                    'error', { retryAction });
                break;
            case 'model_loading_failed':
                this.showError('AI Model Error',
                    'Failed to load the AI model. The service may be starting up.',
                    'warning', { retryAction });
                break;
            case 'timeout':
                this.showError('AI Response Timeout',
                    'The AI is taking too long to respond. Please try again.',
                    'warning', { retryAction });
                break;
            default:
                this.showError('AI Chat Error', details.message || 'An unexpected error occurred.', 'error');
        }
    }

    handleTTSError(type, details, context) {
        const retryAction = () => {
            if (details.retryCallback) details.retryCallback();
        };

        switch (type) {
            case 'service_unavailable':
                this.showError('TTS Service Unavailable',
                    'Text-to-speech is currently offline. Web Speech API will be used as fallback.',
                    'warning');
                break;
            case 'audio_playback_failed':
                this.showError('Audio Playback Error',
                    'Failed to play generated speech. Please check your audio settings.',
                    'warning', { retryAction });
                break;
            case 'voice_not_available':
                this.showError('Voice Error',
                    `Voice "${details.voice}" is not available. Using default voice.`,
                    'info');
                break;
            default:
                this.showError('TTS Error', details.message || 'Text-to-speech error occurred.', 'warning');
        }
    }

    handleSocketError(type, details, context) {
        switch (type) {
            case 'connection_failed':
                this.showError('Connection Error',
                    'Lost connection to server. Attempting to reconnect...',
                    'warning');
                break;
            case 'reconnection_failed':
                this.showError('Connection Lost',
                    'Unable to reconnect to server. Please refresh the page.',
                    'error');
                break;
            default:
                this.showError('Network Error', details.message || 'Network communication error.', 'error');
        }
    }

    handleAPIError(type, details, context) {
        const { status, endpoint } = details;

        if (status >= 500) {
            this.showError('Server Error',
                `Server is experiencing issues (${status}). Please try again later.`,
                'error');
        } else if (status === 404) {
            this.showError('Resource Not Found',
                `The requested resource was not found: ${endpoint}`,
                'warning');
        } else if (status === 403) {
            this.showError('Access Denied',
                'You do not have permission to access this resource.',
                'error');
        } else {
            this.showError('API Error',
                details.message || `Request failed with status ${status}`,
                'error');
        }
    }

    handleGenericError(type, details, context) {
        this.showError('Application Error',
            details.message || 'An unexpected error occurred.',
            'error');
    }

    // Display error notification to user
    showError(title, message, level = 'error', context = {}) {
        const notification = document.getElementById('error-notification');
        const titleEl = notification.querySelector('.error-title');
        const messageEl = notification.querySelector('.error-message');
        const retryBtn = notification.querySelector('.error-retry');

        titleEl.textContent = title;
        messageEl.textContent = message;

        // Set notification style based on level
        notification.className = `error-notification ${level}`;

        // Show/hide retry button
        if (context.retryAction) {
            retryBtn.classList.remove('hidden');
            this.currentErrorContext = context;
        } else {
            retryBtn.classList.add('hidden');
            this.currentErrorContext = null;
        }

        // Show notification
        notification.classList.remove('hidden');
        setTimeout(() => notification.classList.add('show'), 10);

        // Auto-hide after delay (except for errors)
        if (this.errorDisplayTimeout) {
            clearTimeout(this.errorDisplayTimeout);
        }

        const autoHideDelay = level === 'error' ? 8000 : level === 'warning' ? 5000 : 3000;
        this.errorDisplayTimeout = setTimeout(() => {
            this.hideError();
        }, autoHideDelay);

        console.warn(`🚨 ${level.toUpperCase()}: ${title} - ${message}`);
    }

    hideError() {
        const notification = document.getElementById('error-notification');
        notification.classList.remove('show');

        setTimeout(() => {
            notification.classList.add('hidden');
            this.currentErrorContext = null;
        }, 300);

        if (this.errorDisplayTimeout) {
            clearTimeout(this.errorDisplayTimeout);
            this.errorDisplayTimeout = null;
        }
    }

    // Logging and retry management
    logError(type, context) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type,
            context
        };

        this.errorLog.push(logEntry);

        // Maintain log size
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }

        console.error(`[ErrorManager] ${type}:`, context);
    }

    getRetryCount(service, type) {
        const key = `${service}:${type}`;
        return this.retryAttempts.get(key) || 0;
    }

    incrementRetryCount(service, type) {
        const key = `${service}:${type}`;
        const count = this.getRetryCount(service, type) + 1;
        this.retryAttempts.set(key, count);
        return count;
    }

    resetRetryCount(service, type) {
        const key = `${service}:${type}`;
        this.retryAttempts.delete(key);
    }

    // Service health checking
    shouldRetry(service, type) {
        return this.getRetryCount(service, type) < this.maxRetries;
    }

    // Get error statistics
    getErrorStats() {
        const stats = {
            total: this.errorLog.length,
            byType: {},
            recent: this.errorLog.slice(-10)
        };

        this.errorLog.forEach(entry => {
            stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
        });

        return stats;
    }

    // Clear error log
    clearErrorLog() {
        this.errorLog = [];
        console.log('✅ Error log cleared');
    }
}

// Export for use in other modules
export { ErrorManager };
