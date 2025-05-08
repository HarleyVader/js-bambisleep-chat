# BambiSleep Chat Codebase Analysis

Based on the 139 files in the codebase, here's a breakdown of the functionality of each component:

## Main Server Files

- [ ] **server.js**: Application entry point that manages the complete server lifecycle. It:
  - [ ] Initializes Express with middleware stack (CORS, cookies, file uploads)
  - [ ] Sets up real-time socket communication with connection tracking
  - [ ] Configures routes including API endpoints and static asset serving
  - [ ] Implements a 5-step startup sequence (DB→App→Scrapers→Workers→HTTP)
  - [ ] Manages graceful shutdown with worker cleanup
  - [ ] Provides TTS API integration with Kokoro for voice synthesis
  - [ ] Implements health check endpoints and resource monitoring
  - [ ] Handles socket lifecycle with worker thread management per connection
  - [ ] Manages session loading/saving via socket events
  - [ ] Routes session requests to lmstudio.js worker

## Configuration System

### Config Directory (`config/`)

- [ ] **config/config.js**: Core configuration management that:
  - [ ] Loads environment variables with validation schemas
  - [ ] Provides centralized config access for all modules
  - [ ] Implements sensible defaults for development
  - [ ] Handles sensitive value masking for logging
  - [ ] Manages server ports, timeouts, and feature flags
  - [ ] Defines API keys and external service endpoints
  - [ ] Controls logging verbosity and paths
  - [ ] Provides config validation on startup

- [ ] **config/db.js**: Database configuration that:
  - [ ] Manages MongoDB connection strings and credentials
  - [ ] Configures connection pools and timeout settings
  - [ ] Implements retry logic for connection issues
  - [ ] Defines collection names and indexes
  - [ ] Controls query timeout thresholds
  - [ ] Provides connection status monitoring
  - [ ] Handles replica set configuration when available

- [ ] **config/dbConnection.js**: Database connection utilities that:
  - [ ] Establishes pooled connections to MongoDB
  - [ ] Manages connection lifecycle and health checks
  - [ ] Implements connection sharing across modules
  - [ ] Provides standardized error handling for DB operations
  - [ ] Monitors connection performance metrics
  - [ ] Handles graceful connection termination

- [ ] **config/footer.config.js**: Footer configuration that:
  - [ ] Defines footer structure and link categories
  - [ ] Manages footer display settings for different pages
  - [ ] Provides customizable link sections (Control, Core, Community)
  - [ ] Defines attribution and copyright information
  - [ ] Controls footer responsiveness settings

- [ ] **config/triggers.json**: Trigger definitions that:
  - [ ] Stores trigger names, descriptions, and categories
  - [ ] Defines pattern matching rules for trigger detection
  - [ ] Specifies XP rewards for trigger usage
  - [ ] Defines level requirements for specific triggers
  - [ ] Controls trigger sound/visual effect pairings
  - [ ] Maps triggers to specific prompt modifications
  - [ ] Defines trigger strength and cumulative effects

## Models

### Data Models Directory (`models/`)

- [ ] **models/ChatMessage.js**: Message persistence system that:
  - [ ] Implements MongoDB schema for chat message storage
  - [ ] Defines message structure with username, content, metadata
  - [ ] Provides retrieve methods with pagination and filtering
  - [ ] Implements efficient batch saving for message history
  - [ ] Handles message encoding/decoding for special content
  - [ ] Includes connection pooling for performance optimization
  - [ ] Adds database health check methods for monitoring
  - [ ] Provides performance tracking features for bottleneck detection
  - [ ] Implements soft deletion for message retention policy
  - [ ] Creates custom indexes for efficient retrieval
  - [ ] Manages message ownership and access control
  - [ ] Includes timestamps for sorting and activity tracking

- [ ] **models/Profile.js**: User profile management that:
  - [ ] Handles creation, retrieval, and updating of user profiles
  - [ ] Manages customization options like avatar and header images
  - [ ] Implements XP/leveling system with progression logic
  - [ ] Tracks trigger usage history with timestamps
  - [ ] Provides cookie-based authentication for profile access
  - [ ] Maintains system control settings like collar and spiral
  - [ ] Implements progressive feature unlocking based on XP level
  - [ ] Tracks user statistics like messages sent and generation count
  - [ ] Handles season participation and preferences
  - [ ] Manages display name and profile visibility settings
  - [ ] Includes schema validation with error handling
  - [ ] Provides search functionality for community profiles
  - [ ] Implements middleware for profile-based access control

- [ ] **models/SessionHistory.js**: Session state tracking that:
  - [ ] Stores user session data with username association
  - [ ] Captures message history with role assignment
  - [ ] Manages active triggers for session context
  - [ ] Tracks collar settings including text and enabled state
  - [ ] Stores spiral settings with parameters for width and speed
  - [ ] Maintains metadata for creation time and last activity
  - [ ] Implements sharing functionality via unique tokens
  - [ ] Provides filtered retrieval by username and settings
  - [ ] Manages privacy settings for public/private sessions
  - [ ] Creates efficient indexing for fast retrieval
  - [ ] Implements cleanup methods for old sessions
  - [ ] Provides statistics tracking for usage patterns
  - [ ] Handles CRUD operations with validation
  - [ ] Supports commenting system for shared sessions

- [ ] **models/Scraper.js**: Web content extraction system that:
  - [ ] Defines schema for scraping job tracking
  - [ ] Stores source URLs with type categorization
  - [ ] Maintains status tracking for job lifecycle
  - [ ] Records submission metadata like timestamp and submitter
  - [ ] Implements vote tracking with upvotes and downvotes
  - [ ] Provides commenting functionality for community feedback
  - [ ] Stores extraction results with type-specific formatting
  - [ ] Supports multiple content types (text, image, video)
  - [ ] Includes retrieval methods with sorting and filtering
  - [ ] Implements content moderation with automatic flagging
  - [ ] Handles error states and job failure tracking
  - [ ] Provides statistics calculation for dashboard display
  - [ ] Manages content deduplication with URL normalization

## Utilities

### Utility Directory (`utils/`)

- [ ] **utils/logger.js**: Logging infrastructure that:
  - [ ] Implements multi-level logging (info, warning, error, debug)
  - [ ] Provides console output with custom color formatting
  - [ ] Creates structured log entries with timestamps
  - [ ] Implements log rotation for file-based logging
  - [ ] Controls verbosity through environment configuration
  - [ ] Formats error stacks for improved readability
  - [ ] Implements log sanitization for sensitive information
  - [ ] Provides categorical logging with context labels
  - [ ] Handles uncaught exceptions and promise rejections
  - [ ] Implements asynchronous logging for performance
  - [ ] Creates specialized logger instances per module
  - [ ] Provides performance timing methods for operations

- [ ] **utils/gracefulShutdown.js**: Server termination utility that:
  - [ ] Registers cleanup handlers for process signals (SIGTERM, SIGINT)
  - [ ] Orchestrates sequential resource cleanup on shutdown
  - [ ] Closes database connections with timeout handling
  - [ ] Terminates worker threads with graceful state saving
  - [ ] Completes in-flight requests before closing HTTP server
  - [ ] Notifies clients of impending shutdown via sockets
  - [ ] Implements timeout-based forced termination
  - [ ] Logs shutdown progress for monitoring
  - [ ] Reports shutdown status for monitoring systems

- [ ] **utils/connectionMonitor.js**: System health checker that:
  - [ ] Periodically tests database connectivity
  - [ ] Implements performance metrics for monitoring systems

- [ ] **utils/errorHandler.js**: Error management system that:
  - [ ] Provides centralized error handling with categorization
  - [ ] Manages sensitive information redaction in errors

- [ ] **utils/garbageCollector.js**: Memory optimization that:
  - [ ] Implements periodic memory usage analysis
  - [ ] Provides per-module memory usage statistics

- [ ] **utils/doxxerinator.js**: Text processing utility that:
  - [ ] Implements content filtering and sanitization
  - [ ] Provides context analysis for safety enforcement

- [ ] **utils/jsonSchemaGenerator.js**: Data validation that:
  - [ ] Creates JSON Schema definitions from sample data
  - [ ] Provides schema caching for performance

- [ ] **utils/dbConnection.js**: Database interface that:
  - [ ] Implements connection pooling for MongoDB
  - [ ] Manages replica set topology awareness

- [ ] **utils/memory-management.js**: Memory tracking that:
  - [ ] Monitors heap usage and allocation patterns
  - [ ] Provides memory-related alert generation

## Middleware

### Middleware Directory (`middleware/`)

- [ ] **middleware/auth.js**: Authentication handler that:
  - [ ] Extracts username from cookies or request parameters
  - [ ] Maintains lightweight authentication without passwords

- [ ] **middleware/error.js**: Error handling middleware that:
  - [ ] Defines standardized error types with status codes
  - [ ] Renders error pages with consistent templating

- [ ] **middleware/bambisleepChalk.js**: Output styling that:
  - [ ] Implements console output color formatting
  - [ ] Provides header and section styling

## Controllers

### Business Logic Directory (`controllers/`)

- [ ] **controllers/chatController.js**: Chat management that:
  - [ ] Implements message retrieval with pagination
  - [ ] Handles message threading and relationship tracking

- [ ] **controllers/profileController.js**: User management that:
  - [ ] Implements profile CRUD operations
  - [ ] Handles profile merging for returning users

- [ ] **controllers/trigger.js**: Trigger processing that:
  - [ ] Loads trigger definitions from configuration
  - [ ] Provides trigger category filtering and organization

- [ ] **controllers/scraperController.js**: Content extraction that:
  - [ ] Coordinates different scraper worker types
  - [ ] Provides content search and discovery

- [ ] **controllers/authController.js**: Authentication system that:
  - [ ] Implements login and registration processes
  - [ ] Provides secure logout handling

## Routes

### Routes Directory (`routes/`)

- [ ] **routes/index.js**: Application entry point that:
  - [ ] Manages dynamic route loading and registration
  - [ ] Provides profile data API with authorization checks

- [ ] **routes/psychodelic-trigger-mania.js**: Visual effects manager that:
  - [ ] Renders specialized trigger visualization interface
  - [ ] Handles user object propagation to templates

- [ ] **routes/help.js**: Documentation and guidance that:
  - [ ] Renders help center interface with documentation
  - [ ] Sets up context variables for template rendering

- [ ] **routes/scrapers.js**: Content extraction UI that:
  - [ ] Renders scraper management interface
  - [ ] Provides API for statistics and status queries

- [ ] **routes/profile.js**: User profile management that:
  - [ ] Implements profile creation, reading, updating, deletion
  - [ ] Sets up router with custom base path export

- [ ] **routes/chatRoutes.js**: Chat functionality that:
  - [ ] Provides API for retrieving chat message history
  - [ ] Implements error handling with status codes

- [ ] **routes/apiRoutes.js**: General API endpoints that:
  - [ ] Provides centralized API routing management
  - [ ] Implements endpoint documentation with comments

- [ ] **routes/sessions.js**: Session management that:
  - [ ] Provides API for retrieving user session history
  - [ ] Implements logging for error tracking

- [ ] **routes/auth.js**: Authentication management that:
  - [ ] Implements login and registration endpoints
  - [ ] Manages authentication state persistence

- [ ] **routes/tts.js**: Text-to-speech integration that:
  - [ ] Provides API endpoint for text-to-speech conversion
  - [ ] Manages content filtering for appropriate output

- [ ] **routes/trigger-scripts.js**: Trigger content that:
  - [ ] Provides interface for trigger script generation
  - [ ] Implements error handling with friendly messages

## Socket Handlers

### Socket Management Directory (`sockets/`)

- [ ] **sockets/setupSocket.js**: Core socket initialization and event registration. Establishes connection protocols and middleware.

- [ ] **sockets/profileSockets.js**: Real-time profile management that:
  - [ ] Handles update and synchronization of user profile data
  - [ ] Updates trigger history tracking

- [ ] **sockets/chatSockets.js**: Real-time messaging infrastructure that:
  - [ ] Manages message broadcasting to public and private channels
  - [ ] Processes emoji and formatting in messages

- [ ] **sockets/lmStudioSockets.js**: AI model integration that:
  - [ ] Routes trigger commands to the LLM processing system
  - [ ] Coordinates with session management for persistence

## Worker Threads

### Worker Coordination (`workers/`)

- [ ] **workers/workerCoordinator.js**: Central worker management system that:
  - [ ] Creates and maintains worker thread pools for different tasks
  - [ ] Implements coordinated database connection strategy

- [ ] **workers/lmstudio.js**: Language model worker that:
  - [ ] Handles session histories with bounded context size
  - [ ] Uses regular expression pattern matching for trigger detection

### Scraper Workers (`workers/scrapers/`)

- [ ] **workers/scrapers/baseWorker.js**: Foundation worker class that:
  - [ ] Provides standard logging interface for all workers
  - [ ] Creates basis for worker specialization

- [ ] **workers/scrapers/textScraping.js**: Text extraction worker that:
  - [ ] Scrapes HTML content for textual information
  - [ ] Handles worker shutdown with cleanup operations

- [ ] **workers/scrapers/imageScraping.js**: Image content worker that:
  - [ ] Extracts images from web pages with metadata
  - [ ] Reports scraping success and failure metrics

- [ ] **workers/scrapers/videoScraping.js**: Video content worker that:
  - [ ] Extracts video content references from websites
  - [ ] Reports completion status to coordinator

## View Templates

### Main Views Directory (`views/`)

- [ ] **views/index.ejs**: Main application interface that:
  - [ ] Provides username modal for initial setup
  - [ ] Manages socket connection and reconnection logic

- [ ] **views/help.ejs**: Help documentation with:
  - [ ] Command and feature reference
  - [ ] Quick start information

- [ ] **views/profile.ejs**: User profile management that:
  - [ ] Provides create/edit/view/delete modes for profiles
  - [ ] Shows stats like generated words and scrapes

- [ ] **views/psychodelic-trigger-mania.ejs**: Visual effects interface that:
  - [ ] Implements eye cursor animations
  - [ ] Integrates with trigger activation system

- [ ] **views/scrapers.ejs**: Content scraping interface that:
  - [ ] Shows scraping statistics dashboard
  - [ ] Formats share buttons for social media

- [ ] **views/error.ejs**: Error display with:
  - [ ] Friendly error messages
  - [ ] Return to safety links

### Partials Directory (`views/partials/`)

- [ ] **views/partials/head.ejs**: Document head configuration that:
  - [ ] Sets meta tags and viewport settings
  - [ ] Provides customizable page title

- [ ] **views/partials/nav.ejs**: Navigation interface that:
  - [ ] Renders main site navigation links
  - [ ] Provides icon-based navigation options

- [ ] **views/partials/footer.ejs**: Footer template that:
  - [ ] Organizes links into categorized columns
  - [ ] Includes customizable link sections (Control, Core, Community, Special Thanks)

- [ ] **views/partials/profile-system-controls.ejs**: Control panel UI that:
  - [ ] Implements level-based feature unlocking system
  - [ ] Provides custom slider controls for various features

### Sessions Directory (`views/sessions/`)

- [ ] **views/sessions/dashboard.ejs**: Session management dashboard that:
  - [ ] Displays session statistics (total, views, likes)
  - [ ] Implements "empty state" for new users

- [ ] **views/sessions/list.ejs**: Simple session listing that:
  - [ ] Renders sessions in a card-based grid layout
  - [ ] Includes tooltips for additional information

- [ ] **views/sessions/modal.ejs**: Session sharing modal that:
  - [ ] Provides interface for making sessions public
  - [ ] Shows success/error state messages

- [ ] **views/sessions/view.ejs**: Detailed session viewing interface that:
  - [ ] Renders complete chat conversation history
  - [ ] Shows user information for each message

## Public Assets

### Audio Directory (`public/audio/`)

- [ ] **Audio File Collection**: Extensive library of trigger-related audio files that:
  - [ ] Provides voice prompts for different triggers (Airhead-Barbie.mp3, Bambi-Sleep.mp3, etc.)
  - [ ] Enables audio feedback for trigger activation

- [ ] **Audio Implementation**: Client-side audio system that:
  - [ ] Preloads critical audio assets on page load
  - [ ] Synchronizes with visual effects for multi-sensory experience

### Client-Side JavaScript (`public/js/`)

- [ ] **system-controls.js**: Central state management that:
  - [ ] Creates a global bambiSystem object for state coordination
  - [ ] Provides state snapshots for session management

- [ ] **bambi-sessions.js**: Session management system that:
  - [ ] Provides session saving, loading, and sharing functionality
  - [ ] Manages token-based sharing system

- [ ] **collar-controls.js**: Collar system that:
  - [ ] Manages collar text configuration interface
  - [ ] Syncs state across browser sessions

- [ ] **spiral-controls.js**: Visual effect system that:
  - [ ] Manages spiral animation parameters
  - [ ] Manages spiral rendering performance

- [ ] **trigger-controls.js**: Trigger management that:
  - [ ] Implements trigger toggle activation/deactivation
  - [ ] Coordinates with the AI conditioning system

- [ ] **psychodelic-trigger-mania.js**: Visual effects that:
  - [ ] Implements p5.js canvas-based animations
  - [ ] Manages spiral parameter persistence

- [ ] **profile.js**: Profile management that:
  - [ ] Implements profile creation, editing, and deletion
  - [ ] Provides drag-and-drop image handling

- [ ] **aigf-core.js**: AI integration that:
  - [ ] Implements chat interface and message handling
  - [ ] Implements typing indicators and presence

- [ ] **text2speech.js**: Voice synthesis that:
  - [ ] Provides text-to-speech functionality for messages
  - [ ] Coordinates with trigger system for voice variations

- [ ] **xp-notification.js**: XP system that:
  - [ ] Implements animated notifications for XP awards
  - [ ] Implements milestone achievement displays

- [ ] **xp-progress.js**: Level tracking that:
  - [ ] Provides visual progress bar for XP/level
  - [ ] Manages level-based feature unlocking

- [ ] **memory-management.js**: Performance optimization that:
  - [ ] Implements browser memory usage monitoring
  - [ ] Provides memory-related event dispatching

- [ ] **performance-monitor.js**: Metrics system that:
  - [ ] Implements real-time performance measurement
  - [ ] Implements periodic performance checks

- [ ] **scrapers.js**: Content extraction that:
  - [ ] Provides scraping job submission interface
  - [ ] Implements pagination for scraping results

- [ ] **scrapers-view.js**: Content display that:
  - [ ] Implements modal displays for scraped content
  - [ ] Manages responsive layouts for different devices

- [ ] **client-renderer.js**: Template rendering that:
  - [ ] Implements client-side HTML templating
  - [ ] Provides render queue for efficient updates

- [ ] **responsive.js**: Layout management that:
  - [ ] Implements responsive design breakpoints
  - [ ] Manages touch vs mouse input detection

- [ ] **error-handler.js**: Client error management that:
  - [ ] Implements global error catching
  - [ ] Manages error-related analytics

- [ ] **bootstrap.min.js**: Framework utilities that:
  - [ ] Provides UI component initialization
  - [ ] Manages responsive grid system

- [ ] **trigger-script.js**: Script generation that:
  - [ ] Implements trigger script creation and formatting
  - [ ] Manages script categorization and organization

### Style and Media Assets

- [ ] **public/css/**: Style files (bambis.css, bootstrap.min.css, style.css, profile.css, sessions.css, scrapers.css, dashboard.css).
- [ ] **public/images/**: Visual assets including logos, backgrounds, and animations.
- [ ] **public/gif/**: Animated GIF assets for profiles and UI elements.

## Tests and Documentation

- [ ] **tests/**: Testing suites for chat, profile, socket, and worker functionality.
- [ ] **docs/**: Documentation files including folder structure and API reference.

## Key Functionality

1. [ ] **Chat system** with persistent storage and chronological display
2. [ ] **User profiles** with customization, XP/leveling, and personalization
3. [ ] **Text-to-Speech** integration via Kokoro API
4. [ ] **AI integration** through LMStudio with content filtering
5. [ ] **Web scraping** for content retrieval and analysis
6. [ ] **Session tracking** for persistent user interactions
7. [ ] **Real-time socket communication** with fallback options
8. [ ] **Worker thread processing** for CPU-intensive tasks
9. [ ] **Trigger system** for hypnotic suggestions and visual effects
10. [ ] **State management** with central bambiSystem object and event notifications
11. [ ] **Session history** with loading, saving, and sharing capabilities
12. [ ] **Progressive feature unlocking** based on user XP level

## Session Management System

The session management functionality flows through these interconnected components:

1. [ ] **bambi-sessions.js** (client) collects state and sends save/load requests
2. [ ] **server.js** (server) routes session requests to appropriate handlers  
3. [ ] **lmstudio.js** (worker) processes and stores session data
4. [ ] **SessionHistory.js** (model) defines database schema for persistence
5. [ ] **profile-system-controls.ejs** (view) renders UI for session interactions

Data flows in a circle: UI → client JS → socket events → worker → database → response → client JS → UI update.

The application architecture prioritizes direct solutions and performance while maintaining separation of concerns, focusing on handling multiple concurrent connections with proper resource management.