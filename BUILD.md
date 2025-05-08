# BambiSleep Chat Codebase Analysis

Based on the 139 files in the codebase, here's a breakdown of the functionality of each component:

## Main Server Files

- **server.js**: Application entry point that manages the complete server lifecycle. It:
  - Initializes Express with middleware stack (CORS, cookies, file uploads)
  - Sets up real-time socket communication with connection tracking
  - Configures routes including API endpoints and static asset serving
  - Implements a 5-step startup sequence (DB→App→Scrapers→Workers→HTTP)
  - Manages graceful shutdown with worker cleanup
  - Provides TTS API integration with Kokoro for voice synthesis
  - Implements health check endpoints and resource monitoring
  - Handles socket lifecycle with worker thread management per connection
  - Manages session loading/saving via socket events
  - Routes session requests to lmstudio.js worker

## Configuration System

### Config Directory (`config/`)

- **config/config.js**: Core configuration management that:
  - Loads environment variables with validation schemas
  - Provides centralized config access for all modules
  - Implements sensible defaults for development
  - Handles sensitive value masking for logging
  - Manages server ports, timeouts, and feature flags
  - Defines API keys and external service endpoints
  - Controls logging verbosity and paths
  - Provides config validation on startup

- **config/db.js**: Database configuration that:
  - Manages MongoDB connection strings and credentials
  - Configures connection pools and timeout settings
  - Implements retry logic for connection issues
  - Defines collection names and indexes
  - Controls query timeout thresholds
  - Provides connection status monitoring
  - Handles replica set configuration when available

- **config/dbConnection.js**: Database connection utilities that:
  - Establishes pooled connections to MongoDB
  - Manages connection lifecycle and health checks
  - Implements connection sharing across modules
  - Provides standardized error handling for DB operations
  - Monitors connection performance metrics
  - Handles graceful connection termination

- **config/footer.config.js**: Footer configuration that:
  - Defines footer structure and link categories
  - Manages footer display settings for different pages
  - Provides customizable link sections (Control, Core, Community)
  - Defines attribution and copyright information
  - Controls footer responsiveness settings

- **config/triggers.json**: Trigger definitions that:
  - Stores trigger names, descriptions, and categories
  - Defines pattern matching rules for trigger detection
  - Specifies XP rewards for trigger usage
  - Defines level requirements for specific triggers
  - Controls trigger sound/visual effect pairings
  - Maps triggers to specific prompt modifications
  - Defines trigger strength and cumulative effects

## Models

### Data Models Directory (`models/`)

- **models/ChatMessage.js**: Message persistence system that:
  - Implements MongoDB schema for chat message storage
  - Defines message structure with username, content, metadata
  - Provides retrieve methods with pagination and filtering
  - Implements efficient batch saving for message history
  - Handles message encoding/decoding for special content
  - Includes connection pooling for performance optimization
  - Adds database health check methods for monitoring
  - Provides performance tracking features for bottleneck detection
  - Implements soft deletion for message retention policy
  - Creates custom indexes for efficient retrieval
  - Manages message ownership and access control
  - Includes timestamps for sorting and activity tracking

- **models/Profile.js**: User profile management that:
  - Handles creation, retrieval, and updating of user profiles
  - Manages customization options like avatar and header images
  - Implements XP/leveling system with progression logic
  - Tracks trigger usage history with timestamps
  - Provides cookie-based authentication for profile access
  - Maintains system control settings like collar and spiral
  - Implements progressive feature unlocking based on XP level
  - Tracks user statistics like messages sent and generation count
  - Handles season participation and preferences
  - Manages display name and profile visibility settings
  - Includes schema validation with error handling
  - Provides search functionality for community profiles
  - Implements middleware for profile-based access control

- **models/SessionHistory.js**: Session state tracking that:
  - Stores user session data with username association
  - Captures message history with role assignment
  - Manages active triggers for session context
  - Tracks collar settings including text and enabled state
  - Stores spiral settings with parameters for width and speed
  - Maintains metadata for creation time and last activity
  - Implements sharing functionality via unique tokens
  - Provides filtered retrieval by username and settings
  - Manages privacy settings for public/private sessions
  - Creates efficient indexing for fast retrieval
  - Implements cleanup methods for old sessions
  - Provides statistics tracking for usage patterns
  - Handles CRUD operations with validation
  - Supports commenting system for shared sessions

- **models/Scraper.js**: Web content extraction system that:
  - Defines schema for scraping job tracking
  - Stores source URLs with type categorization
  - Maintains status tracking for job lifecycle
  - Records submission metadata like timestamp and submitter
  - Implements vote tracking with upvotes and downvotes
  - Provides commenting functionality for community feedback
  - Stores extraction results with type-specific formatting
  - Supports multiple content types (text, image, video)
  - Includes retrieval methods with sorting and filtering
  - Implements content moderation with automatic flagging
  - Handles error states and job failure tracking
  - Provides statistics calculation for dashboard display
  - Manages content deduplication with URL normalization

## Utilities

### Utility Directory (`utils/`)

- **utils/logger.js**: Logging infrastructure that:
  - Implements multi-level logging (info, warning, error, debug)
  - Provides console output with custom color formatting
  - Creates structured log entries with timestamps
  - Implements log rotation for file-based logging
  - Controls verbosity through environment configuration
  - Formats error stacks for improved readability
  - Implements log sanitization for sensitive information
  - Provides categorical logging with context labels
  - Handles uncaught exceptions and promise rejections
  - Implements asynchronous logging for performance
  - Creates specialized logger instances per module
  - Provides performance timing methods for operations

- **utils/gracefulShutdown.js**: Server termination utility that:
  - Registers cleanup handlers for process signals (SIGTERM, SIGINT)
  - Orchestrates sequential resource cleanup on shutdown
  - Closes database connections with timeout handling
  - Terminates worker threads with graceful state saving
  - Completes in-flight requests before closing HTTP server
  - Notifies clients of impending shutdown via sockets
  - Implements timeout-based forced termination
  - Logs shutdown progress for monitoring
  - Provides custom handler registration for modules
  - Implements prioritized shutdown sequence
  - Handles hanging connections with force closure
  - Reports shutdown status for monitoring systems

- **utils/connectionMonitor.js**: System health checker that:
  - Periodically tests database connectivity
  - Monitors external API availability
  - Tracks connection latency and timeout metrics
  - Implements automatic reconnection strategies
  - Provides health check endpoints for load balancers
  - Logs connectivity changes and warning states
  - Maintains connection status for system dashboard
  - Implements circuit breaker pattern for failing services
  - Provides notification mechanism for critical failures
  - Handles replica set failover monitoring
  - Tracks connection pool utilization
  - Implements performance metrics for monitoring systems

- **utils/errorHandler.js**: Error management system that:
  - Provides centralized error handling with categorization
  - Implements customizable error types and status codes
  - Creates user-friendly error messages for client display
  - Handles different response formats (HTML, JSON)
  - Logs errors with appropriate severity levels
  - Implements error detail exposure based on environment
  - Provides stack trace collection and formatting
  - Creates structured error responses for API clients
  - Handles propagation of errors through middleware
  - Implements custom error types with metadata
  - Provides helper methods for error creation
  - Manages sensitive information redaction in errors

- **utils/garbageCollector.js**: Memory optimization that:
  - Implements periodic memory usage analysis
  - Cleans up idle sessions based on activity thresholds
  - Monitors memory thresholds and triggers cleanup
  - Implements scheduled cleanup operations
  - Provides memory usage reporting for monitoring
  - Handles large object cleanup for memory reclamation
  - Implements worker thread memory management
  - Provides memory leak detection heuristics
  - Manages heap snapshots for critical scenarios
  - Implements adaptive garbage collection frequency
  - Tracks object retention patterns for optimization
  - Provides per-module memory usage statistics

- **utils/doxxerinator.js**: Text processing utility that:
  - Implements content filtering and sanitization
  - Provides pattern matching for sensitive information
  - Handles text analysis for trigger detection
  - Implements content moderation with custom rules
  - Extracts metadata from textual content
  - Provides keyword detection and highlighting
  - Implements sentiment analysis for messages
  - Handles phrase extraction and categorization
  - Provides text similarity comparison
  - Implements custom regex pattern library
  - Manages banned word/phrase detection
  - Provides context analysis for safety enforcement

- **utils/jsonSchemaGenerator.js**: Data validation that:
  - Creates JSON Schema definitions from sample data
  - Implements validation framework for request data
  - Provides schema enforcement for configuration
  - Handles schema composition and inheritance
  - Implements custom validation rules and formats
  - Provides schema documentation generation
  - Manages version control for schema evolution
  - Implements type coercion with validation
  - Provides error collection and reporting
  - Handles nested object validation
  - Implements conditional validation rules
  - Provides schema caching for performance

- **utils/dbConnection.js**: Database interface that:
  - Implements connection pooling for MongoDB
  - Provides shared connection management
  - Handles connection lifecycle events
  - Implements reconnection logic with backoff
  - Provides transaction support with retries
  - Manages connection authentication
  - Implements connection health checking
  - Provides query timeout and cancellation
  - Handles error mapping and categorization
  - Implements connection string parsing and validation
  - Provides performance metrics collection
  - Manages replica set topology awareness

- **utils/memory-management.js**: Memory tracking that:
  - Monitors heap usage and allocation patterns
  - Implements memory usage limits with enforcement
  - Provides memory statistics reporting
  - Handles large object tracking and cleanup
  - Implements object caching with size constraints
  - Provides memory optimization suggestions
  - Manages resource reservation and release
  - Implements adaptive buffer sizing
  - Provides memory-efficient data structures
  - Handles streaming data with bounded memory
  - Implements worker thread memory isolation
  - Provides memory-related alert generation

## Middleware

### Middleware Directory (`middleware/`)

- **middleware/auth.js**: Authentication handler that:
  - Extracts username from cookies or request parameters
  - Validates user authentication status
  - Creates user context object for request pipeline
  - Handles authorization for protected resources
  - Implements role-based access control
  - Provides redirect handling for unauthenticated requests
  - Manages admin access verification
  - Renders appropriate error responses for auth failures
  - Implements conditional authentication checking
  - Provides session validation and verification
  - Handles profile ownership checking for resources
  - Maintains lightweight authentication without passwords

- **middleware/error.js**: Error handling middleware that:
  - Defines standardized error types with status codes
  - Implements centralized error handling and formatting
  - Distinguishes between production and development responses
  - Provides HTML and JSON error response formats
  - Logs errors with appropriate severity levels
  - Handles custom error creation with metadata
  - Implements status code mapping for error types
  - Provides user-friendly error messages
  - Manages sensitive information redaction
  - Implements stack trace handling based on environment
  - Provides error detail inclusion for debugging
  - Renders error pages with consistent templating

- **middleware/bambisleepChalk.js**: Output styling that:
  - Implements console output color formatting
  - Creates custom color schemes for different outputs
  - Provides theme-based terminal styling
  - Implements gradient and rainbow text effects
  - Manages color support detection for terminals
  - Provides emphasis styles for important information
  - Implements boxed output formatting
  - Creates tabular data formatting
  - Provides progress bar visualization
  - Implements animated spinner effects
  - Manages multi-line text formatting
  - Provides header and section styling

## Controllers

### Business Logic Directory (`controllers/`)

- **controllers/chatController.js**: Chat management that:
  - Implements message retrieval with pagination
  - Provides message persistence with MongoDB
  - Handles message formatting and sanitization
  - Implements chat history management
  - Manages public and private message channels
  - Provides message filtering by user and content
  - Implements message batching for efficiency
  - Handles error states with appropriate responses
  - Provides API integration for message retrieval
  - Implements socket event handling for real-time chat
  - Manages content moderation with filtering
  - Handles message threading and relationship tracking

- **controllers/profileController.js**: User management that:
  - Implements profile CRUD operations
  - Manages XP and level progression logic
  - Provides profile customization and preferences
  - Handles avatar and image management
  - Implements trigger history tracking and retrieval
  - Manages system controls state persistence
  - Provides profile search and discovery
  - Implements community profile listings
  - Handles profile statistics calculation
  - Manages cookie-based authentication
  - Provides season participation tracking
  - Implements field validation and sanitization
  - Handles profile merging for returning users

- **controllers/trigger.js**: Trigger processing that:
  - Loads trigger definitions from configuration
  - Provides standard trigger listing and information
  - Implements trigger activation and deactivation logic
  - Manages trigger history recording with timestamps
  - Handles trigger session state tracking
  - Provides trigger filtering by level requirements
  - Implements trigger event processing with XP awards
  - Manages profile trigger state synchronization
  - Handles mass trigger activation/deactivation
  - Provides API endpoints for trigger management
  - Implements trigger pattern matching with RegEx
  - Manages trigger strength and cumulative effects
  - Provides trigger category filtering and organization

- **controllers/scraperController.js**: Content extraction that:
  - Coordinates different scraper worker types
  - Manages scraping job creation and tracking
  - Implements content submission processing
  - Handles voting and feedback collection
  - Provides content retrieval with filtering
  - Manages statistics calculation for dashboard
  - Implements moderation and flagging system
  - Handles parsing and extraction settings
  - Provides batch operation management
  - Implements content categorization and tagging
  - Manages URL normalization and deduplication
  - Handles error states and failed scrape reporting
  - Provides content search and discovery

- **controllers/authController.js**: Authentication system that:
  - Implements login and registration processes
  - Provides cookie-based authentication
  - Manages session validation and persistence
  - Handles token generation and verification
  - Implements secure password handling
  - Provides login status checking
  - Manages account recovery processes
  - Implements role-based permissions
  - Provides API token management
  - Handles cross-site request forgery protection
  - Manages login attempt limiting and security
  - Implements session expiration and renewal
  - Provides secure logout handling

## Routes

### Routes Directory (`routes/`)

- **routes/index.js**: Application entry point that:
  - Manages dynamic route loading and registration
  - Renders the main application interface with user data
  - Handles application bootstrapping and initialization
  - Implements profile detection from cookies
  - Loads recent chat messages for initial display
  - Retrieves trigger configuration for client usage
  - Provides graceful error handling for route failures
  - Manages fallback rendering with minimal data
  - Implements API endpoints for trigger information
  - Handles 404 errors with friendly response pages
  - Controls route registration order and precedence
  - Validates request parameters for API endpoints
  - Implements health check endpoint for monitoring
  - Provides profile data API with authorization checks

- **routes/psychodelic-trigger-mania.js**: Visual effects manager that:
  - Renders specialized trigger visualization interface
  - Loads user-specific trigger configuration
  - Implements permission checking based on user level
  - Provides spiral and animation control settings
  - Integrates with session history for playback
  - Handles state persistence for visual settings
  - Provides router export with custom base path
  - Associates with template rendering for UI
  - Manages integration with footer configuration
  - Implements session token validation for sharing
  - Sets up page-specific rendering context
  - Handles user object propagation to templates

- **routes/help.js**: Documentation and guidance that:
  - Renders help center interface with documentation
  - Provides user guidance for application features
  - Implements command reference and usage examples
  - Organizes documentation by feature category
  - Integrates with footer configuration
  - Supports dynamic content loading for help topics
  - Manages consistent page structure with templates
  - Implements concise router with focused responsibility
  - Provides tutorial access through centralized UI
  - Sets up context variables for template rendering

- **routes/scrapers.js**: Content extraction UI that:
  - Renders scraper management interface
  - Handles submission forms for new scraping jobs
  - Implements job status tracking and display
  - Provides statistics dashboard for admin usage
  - Manages voting system for scraped content
  - Implements comment system for community feedback
  - Provides API endpoints for content retrieval
  - Handles error states with user-friendly messages
  - Manages pagination for result listings
  - Implements sorting and filtering of results
  - Provides content type categorization
  - Handles image, text and video content differently
  - Manages content deletion based on voting thresholds
  - Implements request validation with sanitization
  - Provides API for statistics and status queries

- **routes/profile.js**: User profile management that:
  - Implements profile creation, reading, updating, deletion
  - Provides profile listing with pagination and sorting
  - Manages authentication via cookie validation
  - Handles profile ownership verification
  - Implements form submission for profile updates
  - Manages field validation and sanitization
  - Provides XP and level display for user progression
  - Implements trigger history tracking with grouping
  - Handles avatar and header image customization
  - Manages cookie setting for user identification
  - Provides authorization checking for profile actions
  - Handles AJAX requests with JSON responses
  - Manages error states with appropriate status codes
  - Implements system controls update endpoint
  - Handles profile deletion with confirmation
  - Provides season selection and management
  - Implements profile search functionality
  - Sets up router with custom base path export

- **routes/chatRoutes.js**: Chat functionality that:
  - Provides API for retrieving chat message history
  - Implements pagination for message requests
  - Handles error logging and response formatting
  - Integrates with message model for persistence
  - Implements efficient message retrieval
  - Provides limited access pattern for security
  - Manages routing with Express router instance
  - Exports focused router with message endpoints
  - Handles parameter validation for limit query
  - Implements error handling with status codes

- **routes/apiRoutes.js**: General API endpoints that:
  - Provides centralized API routing management
  - Handles REST endpoints for various features
  - Implements profile data retrieval endpoints
  - Manages system controls API for preferences
  - Provides performance metrics collection API
  - Handles session history retrieval endpoints
  - Implements data validation for API requests
  - Manages error handling with appropriate status codes
  - Provides sanitized responses for security
  - Implements MongoDB interaction through models
  - Handles authentication checking for protected endpoints
  - Provides standardized response formatting
  - Manages database connection handling with utilities
  - Implements endpoint documentation with comments

- **routes/sessions.js**: Session management that:
  - Provides API for retrieving user session history
  - Implements sorting by last activity time
  - Manages session data persistence and retrieval
  - Handles error states with appropriate responses
  - Provides focused router for session endpoints
  - Exports both named and default router
  - Specifies base path for routing configuration
  - Implements efficient database queries
  - Provides JSON response formatting
  - Uses model for data structure consistency
  - Implements logging for error tracking

- **routes/auth.js**: Authentication management that:
  - Implements login and registration endpoints
  - Manages cookie-based authentication system
  - Provides session validation and verification
  - Handles password hashing and security
  - Implements token generation for session persistence
  - Provides logout functionality with cookie clearing
  - Manages authorization checks for protected routes
  - Implements error handling for auth failures
  - Provides JSON responses for API clients
  - Handles redirect logic for browser-based flows
  - Manages authentication state persistence

- **routes/tts.js**: Text-to-speech integration that:
  - Provides API endpoint for text-to-speech conversion
  - Implements integration with Kokoro TTS service
  - Handles voice selection based on user settings
  - Manages audio format conversion and delivery
  - Implements caching for performance optimization
  - Provides error handling for service failures
  - Manages rate limiting for API usage
  - Implements parameter validation and sanitization
  - Provides stream handling for audio delivery
  - Manages content filtering for appropriate output

- **routes/trigger-scripts.js**: Trigger content that:
  - Provides interface for trigger script generation
  - Loads user's active triggers from profile
  - Manages trigger selection and configuration
  - Implements collar text integration when enabled
  - Renders script content based on active triggers
  - Handles profile retrieval and data extraction
  - Provides API endpoint for saving trigger selections
  - Manages trigger configuration with database updates
  - Loads trigger definitions from configuration files
  - Handles anonymous and authenticated user states
  - Implements error handling with friendly messages

## Socket Handlers

### Socket Management Directory (`sockets/`)

- **sockets/setupSocket.js**: Core socket initialization and event registration. Establishes connection protocols and middleware.

- **sockets/profileSockets.js**: Real-time profile management that:
  - Handles update and synchronization of user profile data
  - Processes trigger activation/deactivation events
  - Manages XP award events and level progression
  - Syncs system control states like collar and spiral settings
  - Broadcasts profile changes to appropriate clients
  - Updates trigger history tracking

- **sockets/chatSockets.js**: Real-time messaging infrastructure that:
  - Manages message broadcasting to public and private channels
  - Implements content moderation and filtering
  - Handles offline message queueing and delivery
  - Tracks user presence and typing indicators
  - Enables direct messaging between users
  - Syncs message history on reconnection
  - Processes emoji and formatting in messages

- **sockets/lmStudioSockets.js**: AI model integration that:
  - Routes trigger commands to the LLM processing system
  - Handles collar text integration with conversation context
  - Manages stream processing for real-time response generation
  - Sends system commands to the AI model worker
  - Tracks conversation context for improved responses
  - Handles error states when generation fails
  - Coordinates with session management for persistence

## Worker Threads

### Worker Coordination (`workers/`)

- **workers/workerCoordinator.js**: Central worker management system that:
  - Creates and maintains worker thread pools for different tasks
  - Implements staggered initialization sequence for worker threads
  - Manages asynchronous request/response communication with workers
  - Handles worker message routing with unique request IDs
  - Tracks pending requests using Map data structure
  - Provides graceful shutdown sequence for all workers
  - Coordinates model loading across worker threads
  - Retries failed requests with exponential backoff
  - Monitors worker health with status reporting
  - Implements coordinated database connection strategy

- **workers/lmstudio.js**: Language model worker that:
  - Handles session histories with bounded context size
  - Manages conversation memory for each client socket
  - Creates dynamic system prompts with trigger conditioning
  - Synchronizes session state with MongoDB on changes
  - Applies garbage collection for idle sessions
  - Awards XP based on quality and length of interactions
  - Updates user profiles with statistics
  - Utilizes LLM models for text generation
  - Integrates collar settings into prompt context
  - Processes user messages with context tracking
  - Formats model responses for client consumption
  - Performs health monitoring for reliability
  - Loads triggers from configuration files
  - Handles worker shutdown with state preservation
  - Provides real-time diagnostics for system health
  - Uses regular expression pattern matching for trigger detection

### Scraper Workers (`workers/scrapers/`)

- **workers/scrapers/baseWorker.js**: Foundation worker class that:
  - Provides standard logging interface for all workers
  - Establishes common worker lifecycle methods
  - Implements consistent message handling patterns
  - Standardizes error reporting across worker types
  - Creates basis for worker specialization

- **workers/scrapers/textScraping.js**: Text extraction worker that:
  - Scrapes HTML content for textual information
  - Parses various document formats (MD, TXT, HTML, CSS, JS)
  - Identifies BambiSleep references in content
  - Stores extracted text in MongoDB with metadata
  - Implements content keyword extraction
  - Provides search functionality for stored content
  - Scans local directories for text documents
  - Handles content categorization and organization
  - Processes recursive directory scanning
  - Extracts meaningful content from HTML structure
  - Manages session-based scraping requests
  - Handles worker shutdown with cleanup operations

- **workers/scrapers/imageScraping.js**: Image content worker that:
  - Extracts images from web pages with metadata
  - Stores image references in database
  - Processes images with content categorization
  - Handles varied image formats and sources
  - Creates serializable image data structures
  - Manages connection and disconnection cleanup
  - Uses Cheerio for DOM manipulation
  - Implements MongoDB schema for image content
  - Standardizes scraping response formats
  - Handles error states during image processing
  - Reports scraping success and failure metrics

- **workers/scrapers/videoScraping.js**: Video content worker that:
  - Extracts video content references from websites
  - Creates database entries for video metadata
  - Manages video processing requests from main thread
  - Implements worker message handling system
  - Follows base worker patterns for consistency
  - Handles MongoDB connection for data persistence
  - Processes shutdown requests gracefully
  - Reports completion status to coordinator

## View Templates

### Main Views Directory (`views/`)

- **views/index.ejs**: Main application interface that:
  - Provides username modal for initial setup
  - Implements chat interface with message history display
  - Sets up socket event listeners for system communication
  - Integrates with profile system controls
  - Displays XP notification system
  - Uses data-username attribute for component coordination
  - Handles trigger loading from user profiles
  - Manages socket connection and reconnection logic

- **views/help.ejs**: Help documentation with:
  - Command and feature reference
  - User guidance for common actions
  - FAQ and troubleshooting tips
  - Quick start information

- **views/profile.ejs**: User profile management that:
  - Provides create/edit/view/delete modes for profiles
  - Displays user level, XP, and achievement information
  - Shows trigger history with timestamp grouping
  - Manages seasons and other profile preferences
  - Implements inline editing for profile fields
  - Provides toggle controls for user triggers
  - Creates modal interfaces for profile editing
  - Includes pagination for community profile listings
  - Shows stats like generated words and scrapes

- **views/psychodelic-trigger-mania.ejs**: Visual effects interface that:
  - Implements eye cursor animations
  - Provides spiral control settings
  - Displays session selector for history replay
  - Includes user-level-based permission controls
  - Integrates with trigger activation system

- **views/scrapers.ejs**: Content scraping interface that:
  - Shows scraping statistics dashboard
  - Displays top upvoted/downvoted submissions
  - Provides content submission forms
  - Implements voting and comment systems
  - Shows processing status for scrape jobs
  - Includes content viewing modals
  - Formats share buttons for social media

- **views/error.ejs**: Error display with:
  - Friendly error messages
  - Troubleshooting suggestions
  - Return to safety links

### Partials Directory (`views/partials/`)

- **views/partials/head.ejs**: Document head configuration that:
  - Sets meta tags and viewport settings
  - Imports CSS stylesheets and fonts
  - Configures favicon and touchicon resources
  - Sets up responsive design parameters
  - Provides customizable page title

- **views/partials/nav.ejs**: Navigation interface that:
  - Renders main site navigation links
  - Implements conditional links based on auth status
  - Creates session-specific subnav when appropriate
  - Highlights active page in navigation
  - Provides icon-based navigation options

- **views/partials/footer.ejs**: Footer template that:
  - Organizes links into categorized columns
  - Displays copyright and attribution information
  - Provides secondary navigation options
  - Shows site branding elements
  - Renders dynamic footer content from server data
  - Includes customizable link sections (Control, Core, Community, Special Thanks)

- **views/partials/profile-system-controls.ejs**: Control panel UI that:
  - Implements level-based feature unlocking system
  - Creates tabbed interface for different control sets
  - Manages trigger toggles with activation buttons
  - Provides collar text configuration interface
  - Displays XP progress bar with level indicators
  - Implements spiral settings with width/speed controls
  - Shows session history loading interface
  - Contains hypnosis and audio players (for higher levels)
  - Manages state persistence through localStorage
  - Implements XP notification animations
  - Provides custom slider controls for various features

### Sessions Directory (`views/sessions/`)

- **views/sessions/dashboard.ejs**: Session management dashboard that:
  - Displays session statistics (total, views, likes)
  - Provides comprehensive filtering options
  - Implements grid/list view toggle with localStorage preference
  - Shows session metadata with interactive elements
  - Includes pagination for large session collections
  - Provides edit and delete functionality with confirmation
  - Displays session visibility status (public/private)
  - Shows trigger count indicators per session
  - Implements "empty state" for new users

- **views/sessions/list.ejs**: Simple session listing that:
  - Renders sessions in a card-based grid layout
  - Shows creation and last activity dates
  - Displays view and reaction statistics
  - Provides share functionality with copy link support
  - Shows public/private status indicators
  - Includes tooltips for additional information

- **views/sessions/modal.ejs**: Session sharing modal that:
  - Provides interface for making sessions public
  - Shows privacy information and warnings
  - Displays share link with copy button
  - Includes social media sharing options
  - Shows success/error state messages

- **views/sessions/view.ejs**: Detailed session viewing interface that:
  - Renders complete chat conversation history
  - Shows system prompts for context
  - Displays active triggers and collar settings
  - Provides reaction buttons (like/dislike)
  - Implements commenting system with real-time updates
  - Shows session statistics (views, likes, dislikes)
  - Provides share functionality for session owner
  - Formats timestamps for readability
  - Shows user information for each message

## Public Assets

### Audio Directory (`public/audio/`)

- **Audio File Collection**: Extensive library of trigger-related audio files that:
  - Provides voice prompts for different triggers (Airhead-Barbie.mp3, Bambi-Sleep.mp3, etc.)
  - Contains sound effects for user level achievements
  - Includes notification sounds for system events
  - Provides ambient background options for sessions
  - Supports hypnotic induction sequences
  - Includes voice prompts for different system states
  - Enables audio feedback for trigger activation

- **Audio Implementation**: Client-side audio system that:
  - Preloads critical audio assets on page load
  - Implements triggered playback via socket events
  - Controls audio volume based on user preferences
  - Manages audio playback states across sessions
  - Enables looping for ambient background tracks
  - Provides audio cues for system events
  - Synchronizes with visual effects for multi-sensory experience

### Client-Side JavaScript (`public/js/`)

- **system-controls.js**: Central state management that:
  - Creates a global bambiSystem object for state coordination
  - Implements localStorage persistence for user preferences
  - Manages state changes with event-based notifications
  - Provides centralized collection of settings
  - Handles state initialization on page load
  - Implements state section isolation (triggers, collar, spirals)
  - Manages feature unlocking based on user level
  - Provides API for other modules to access settings
  - Handles session settings application
  - Creates standardized naming and structure conventions
  - Implements system event dispatching for cross-module communication
  - Provides state snapshots for session management

- **bambi-sessions.js**: Session management system that:
  - Provides session saving, loading, and sharing functionality
  - Implements toast notification system for user feedback
  - Manages in-memory session data with persistence logic
  - Coordinates with system-controls.js for state management
  - Handles socket.io communication for server operations
  - Implements session metadata tracking
  - Provides session sharing modal functionality
  - Manages session listing and filtering
  - Handles application of session settings to UI components
  - Implements history tracking for session interactions
  - Provides session reset and deletion
  - Manages token-based sharing system

- **collar-controls.js**: Collar system that:
  - Manages collar text configuration interface
  - Implements enable/disable toggle functionality
  - Provides XP rewards for collar usage
  - Saves settings to profile via socket events
  - Handles integration with conversation context
  - Provides user feedback on save operations
  - Listens for system state updates
  - Manages UI state for collar text display
  - Handles text validation and formatting
  - Provides easy text entry and submission
  - Implements persistent storage of collar settings
  - Syncs state across browser sessions

- **spiral-controls.js**: Visual effect system that:
  - Manages spiral animation parameters
  - Provides width and speed controls for dual spirals
  - Implements real-time parameter updates
  - Handles spiral enable/disable functionality
  - Provides UI sliders for parameter adjustment
  - Coordinates with trigger activation system
  - Manages persistence of spiral settings
  - Implements socket-based synchronization
  - Handles state management via central system
  - Provides spiral reset to defaults
  - Implements spiral color customization options
  - Manages spiral rendering performance

- **trigger-controls.js**: Trigger management that:
  - Implements trigger toggle activation/deactivation
  - Provides trigger listing and categorization
  - Handles level-based trigger unlocking
  - Manages trigger state persistence
  - Coordinates with socket events for server syncing
  - Implements trigger activation events
  - Provides trigger history tracking
  - Handles trigger filtering and display
  - Implements batch trigger operations
  - Manages trigger state visualization (active/inactive)
  - Provides trigger search functionality
  - Coordinates with the AI conditioning system

- **psychodelic-trigger-mania.js**: Visual effects that:
  - Implements p5.js canvas-based animations
  - Provides spiral animation with customizable parameters
  - Implements eye cursor tracking and animation
  - Handles window resize events for responsive display
  - Manages animation frame rates and performance
  - Provides parameter update API for control system
  - Implements color schemes and transitions
  - Manages spiral rotation and scaling effects
  - Handles animation initialization and teardown
  - Provides render loop with performance optimization
  - Implements visual synchronization with triggers
  - Manages spiral parameter persistence

- **profile.js**: Profile management that:
  - Implements profile creation, editing, and deletion
  - Provides inline editing for profile fields
  - Manages avatar and header image selection
  - Implements XP and level display system
  - Provides trigger history visualization
  - Handles form submission and validation
  - Manages cookie-based authentication
  - Implements profile listing and pagination
  - Provides profile search functionality
  - Handles profile statistics display
  - Manages season participation settings
  - Implements community profile discovery
  - Provides drag-and-drop image handling

- **aigf-core.js**: AI integration that:
  - Implements chat interface and message handling
  - Provides streaming message display with typing effect
  - Manages conversation history with formatting
  - Handles socket events for AI communication
  - Implements message queueing and processing
  - Provides user/AI message distinction
  - Manages conversation context tracking
  - Handles error states and reconnection
  - Implements message encoding and escaping
  - Provides trigger detection in messages
  - Manages message persistence via socket events
  - Implements typing indicators and presence

- **text2speech.js**: Voice synthesis that:
  - Provides text-to-speech functionality for messages
  - Implements voice selection based on preferences
  - Manages audio playback with controls
  - Handles caching for improved performance
  - Provides volume and rate controls
  - Implements queue system for multiple messages
  - Manages TTS API communication
  - Handles error states with fallbacks
  - Provides event notifications for playback
  - Implements auto-play settings and toggling
  - Manages audio resource cleanup
  - Coordinates with trigger system for voice variations

- **xp-notification.js**: XP system that:
  - Implements animated notifications for XP awards
  - Provides leveling up celebration effects
  - Manages XP award visibility and timing
  - Implements queueing for multiple XP awards
  - Handles stacking and merging of notifications
  - Provides customizable notification styling
  - Manages notification positioning and animation
  - Implements sound effects for XP events
  - Handles notification cleanup and DOM management
  - Provides level-up special effects
  - Manages notification preferences
  - Implements milestone achievement displays

- **xp-progress.js**: Level tracking that:
  - Provides visual progress bar for XP/level
  - Implements animated progress updates
  - Manages level thresholds and calculations
  - Provides level-up transition effects
  - Handles current XP and level display
  - Implements tooltip information display
  - Manages progress persistence between sessions
  - Provides XP history tracking
  - Implements statistics for XP sources
  - Handles progress reset and adjustment
  - Provides API for other modules to update XP
  - Manages level-based feature unlocking

- **memory-management.js**: Performance optimization that:
  - Implements browser memory usage monitoring
  - Provides memory leak detection and alerts
  - Manages cleanup of unused resources
  - Implements periodic garbage collection
  - Provides memory usage statistics
  - Handles large object tracking and cleanup
  - Manages DOM element reference tracking
  - Implements memory threshold alerts
  - Provides optimization suggestions
  - Handles local storage size management
  - Implements session-based cleanup
  - Provides memory-related event dispatching

- **performance-monitor.js**: Metrics system that:
  - Implements real-time performance measurement
  - Provides frame rate monitoring for animations
  - Tracks API call response times
  - Implements resource timing collection
  - Provides performance data visualization
  - Manages metrics collection and aggregation
  - Handles performance threshold alerts
  - Provides automatic slowdown detection
  - Implements performance data reporting
  - Manages long task detection
  - Provides API for custom timing points
  - Implements periodic performance checks

- **scrapers.js**: Content extraction that:
  - Provides scraping job submission interface
  - Manages job status tracking and display
  - Implements content voting system
  - Provides scraping results visualization
  - Handles scraping form validation
  - Manages scraper type selection
  - Implements batch scraping operations
  - Provides URL validation and normalization
  - Handles error states and job failures
  - Manages job cancellation functionality
  - Provides result filtering and sorting
  - Implements pagination for scraping results

- **scrapers-view.js**: Content display that:
  - Implements modal displays for scraped content
  - Provides content type-specific formatting
  - Manages image gallery for scraped images
  - Implements comment system for content
  - Provides voting and rating functionality
  - Handles content sharing options
  - Manages content metadata display
  - Implements content categorization view
  - Provides search within scraped content
  - Handles modal navigation and keyboard shortcuts
  - Implements content preview generation
  - Manages responsive layouts for different devices

- **client-renderer.js**: Template rendering that:
  - Implements client-side HTML templating
  - Provides component rendering without page reload
  - Manages template caching for performance
  - Implements data binding for UI updates
  - Provides partial content replacement
  - Handles rendering errors with fallbacks
  - Manages template preprocessing
  - Implements conditional rendering logic
  - Provides event rebinding for dynamic content
  - Manages template versioning
  - Implements template composition
  - Provides render queue for efficient updates

- **responsive.js**: Layout management that:
  - Implements responsive design breakpoints
  - Provides textarea auto-expansion functionality
  - Manages mobile vs desktop layouts
  - Implements window resize handling
  - Provides responsive image handling
  - Manages navigation menu responsiveness
  - Implements responsive table layouts
  - Provides orientation change handling
  - Manages scroll position preservation
  - Implements element visibility based on viewport
  - Provides responsive font sizing
  - Manages touch vs mouse input detection

- **error-handler.js**: Client error management that:
  - Implements global error catching
  - Provides friendly error messages to users
  - Manages error logging and reporting
  - Implements automatic recovery attempts
  - Provides connection loss handling
  - Manages error notification system
  - Implements error categorization
  - Provides debugging information collection
  - Manages crash recovery functionality
  - Implements graceful degradation
  - Provides session state preservation during errors
  - Manages error-related analytics

- **bootstrap.min.js**: Framework utilities that:
  - Provides UI component initialization
  - Implements modal dialog functionality
  - Manages dropdown menus and navigation
  - Provides tooltip and popover systems
  - Implements tab interface functionality
  - Manages form validation visual cues
  - Provides carousel and slider components
  - Implements collapse functionality
  - Manages button states and behavior
  - Provides toast notification system
  - Implements utility classes and helpers
  - Manages responsive grid system

- **trigger-script.js**: Script generation that:
  - Implements trigger script creation and formatting
  - Provides customizable script parameters
  - Manages script export and sharing
  - Implements script template selection
  - Provides variable substitution in scripts
  - Manages script history and favorites
  - Implements script generation from triggers
  - Provides script preview functionality
  - Manages script timing and pacing options
  - Implements script saving and loading
  - Provides audio integration with scripts
  - Manages script categorization and organization

### Style and Media Assets

- **public/css/**: Style files (bambis.css, bootstrap.min.css, style.css, profile.css, sessions.css, scrapers.css, dashboard.css).
- **public/images/**: Visual assets including logos, backgrounds, and animations.
- **public/gif/**: Animated GIF assets for profiles and UI elements.

## Tests and Documentation

- **tests/**: Testing suites for chat, profile, socket, and worker functionality.
- **docs/**: Documentation files including folder structure and API reference.

## Key Functionality

1. **Chat system** with persistent storage and chronological display
2. **User profiles** with customization, XP/leveling, and personalization
3. **Text-to-Speech** integration via Kokoro API
4. **AI integration** through LMStudio with content filtering
5. **Web scraping** for content retrieval and analysis
6. **Session tracking** for persistent user interactions
7. **Real-time socket communication** with fallback options
8. **Worker thread processing** for CPU-intensive tasks
9. **Trigger system** for hypnotic suggestions and visual effects
10. **State management** with central bambiSystem object and event notifications
11. **Session history** with loading, saving, and sharing capabilities
12. **Progressive feature unlocking** based on user XP level

## Session Management System

The session management functionality flows through these interconnected components:

1. **bambi-sessions.js** (client) collects state and sends save/load requests
2. **server.js** (server) routes session requests to appropriate handlers  
3. **lmstudio.js** (worker) processes and stores session data
4. **SessionHistory.js** (model) defines database schema for persistence
5. **profile-system-controls.ejs** (view) renders UI for session interactions

Data flows in a circle: UI → client JS → socket events → worker → database → response → client JS → UI update.

The application architecture prioritizes direct solutions and performance while maintaining separation of concerns, focusing on handling multiple concurrent connections with proper resource management.