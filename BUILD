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

- **config/config.js**: Manages configuration using environment variables with validation schemas for server ports, databases, APIs, timeouts, logging, and special handling for sensitive values.

## Models

- **models/ChatMessage.js**: MongoDB schema for chat messages with retrieve/save methods, error handling, connection pooling, health check methods and performance tracking features.
- **models/Profile.js**: User profile management with customization, XP/leveling, trigger tracking, cookie-based authentication and system controls.
- **models/SessionHistory.js**: Tracks user session data including messages, active triggers, collar settings and spiral settings. Stores metadata for creation time and last activity. Supports session sharing via tokens and filtered retrieval by username.
- **models/Scraper.js**: Web scraping data models with metadata storage and retrieval.

## Routes

- **routes/index.js**: Main landing page and primary navigation.
- **routes/psychodelic-trigger-mania.js**: Visual trigger effects with animation controls.
- **routes/help.js**: Help documentation and user guidance.
- **routes/scrapers.js**: Web scraping functionality and content retrieval.
- **routes/profile.js**: Profile management and customization.
- **routes/chatRoutes.js**: Chat-related API endpoints and message persistence.
- **routes/apiRoutes.js**: General API routes for application features.
- **routes/sessions.js**: Session tracking and management with API endpoints for retrieving, saving, and sharing session data. Provides username-based session filtering and session metadata management.
- **routes/auth.js**: Authentication and authorization endpoints.
- **routes/tts.js**: Text-to-speech conversion endpoints.

## Socket Handlers

- **sockets/profileSockets.js**: Real-time profile updates and state synchronization.
- **sockets/chatSockets.js**: Real-time chat with message broadcasting, content filtering, and offline message queueing.
- **sockets/lmStudioSockets.js**: LMStudio integration for AI generation. Handles trigger updates and collar commands for LLM processing.
- **sockets/index.js**: Socket initialization and configuration.
- **sockets/socketManager.js**: Connection pooling, lifecycle management, and event buffering.

## Worker Threads

- **workers/workerCoordinator.js**: Worker thread pool management and task distribution.
- **workers/lmstudio.js**: Language model worker that:
  - Handles session histories and conversation context
  - Implements AI integration and message processing
  - Manages trigger conditioning for prompts
  - Integrates collar settings into conversations
  - Performs health monitoring for reliability
  - Conducts garbage collection for idle sessions
  - Tracks XP based on interaction quality
  - Syncs session state with MongoDB
  - Processes system prompts based on active triggers
  - Maintains bounded session history per user
- **workers/baseWorker.js**: Common worker functionality and lifecycle management.
- **workers/videoScraping.js**: Video content extraction worker.
- **workers/textScraping.js**: Text content extraction worker.
- **workers/imageScraping.js**: Image content scraping worker.

## Utilities

- **utils/logger.js**: Multi-level logging system (info, warning, error, debug) with console output formatting and log rotation.
- **utils/gracefulShutdown.js**: Orderly resource cleanup on termination signals.
- **utils/connectionMonitor.js**: Database and API connectivity monitoring.
- **utils/errorHandler.js**: Centralized error handling and reporting.
- **utils/garbageCollector.js**: Memory management, optimization, threshold monitoring and cleanup scheduling.
- **utils/doxxerinator.js**: Text analysis and processing utilities.
- **utils/jsonSchemaGenerator.js**: Schema generation for validation.
- **utils/dbConnection.js**: Database connection pooling utilities.

## Middleware

- **middleware/auth.js**: Authentication and authorization verification.
- **middleware/error.js**: Error handling and client-friendly responses.
- **middleware/bambisleepChalk.js**: Console output styling for logging.

## Controllers

- **controllers/chatController.js**: Chat functionality business logic.
- **controllers/profileController.js**: Profile management operations.
- **controllers/trigger.js**: Trigger system logic and processing.
- **controllers/scraperController.js**: Content scraping coordination.
- **controllers/authController.js**: Authentication flow management.

## View Templates

- **views/index.ejs**: Main application interface with:
  - Username modal for initial setup
  - Chat interface with message history display
  - Socket event listeners for system communication
  - Integration with profile system controls
  - XP notification display system
  - Data-username attribute for component coordination
- **views/help.ejs**: User guidance documentation with command references.
- **views/profile.ejs**: User profile management with customization options and trigger settings.
- **views/psychodelic-trigger-mania.ejs**: Visual trigger effects with animation controls.
- **views/scrapers.ejs**: Content scraping configuration and result display.
- **views/error.ejs**: Error display with simple troubleshooting steps.

- **views/partials/head.ejs**: Meta tags, CSS imports and common header elements.
- **views/partials/nav.ejs**: Navigation bar with responsive menu controls.
- **views/partials/footer.ejs**: Footer with credits and site information.
- **views/partials/profile-system-controls.ejs**: UI template for system controls that:
  - Renders control panels based on user XP level
  - Implements progressive feature unlocking
  - Contains triggers, collar, session history panels
  - Loads and initializes client-side scripts
  - Displays XP progress and level information
  - Manages tab navigation between control panels

- **views/sessions/dashboard.ejs**: Session management overview with filtering options.
- **views/sessions/list.ejs**: Sortable session listing with interaction counts.
- **views/sessions/modal.ejs**: Modal dialog for session details and operations.
- **views/sessions/view.ejs**: Detailed session view with interaction history.

## Public Assets

- **public/css/**: Style files (bambis.css, bootstrap.min.css, style.css, profile.css, sessions.css, scrapers.css, dashboard.css).
- **public/js/**: Client-side JavaScript files:
  - **aigf-core.js**: Core AI generation and text-to-speech integration.
  - **bambi-sessions.js**: Central client-side session management that:
    - Handles loading, saving, and sharing of user sessions
    - Manages in-memory session data with persistence
    - Implements toast notification system for feedback
    - Provides functions to apply session settings to UI
    - Coordinates with bambiSystem for state management
    - Uses socket.io for real-time server communication
  - **client-renderer.js**: Client-side component rendering to reduce server load.
  - **collar-controls.js**: Manages collar settings for users with XP awards for usage.
  - **memory-management.js**: Browser memory usage tracking and optimization.
  - **performance-monitor.js**: Real-time performance metrics and analysis.
  - **profile.js**: Profile management, inline editing, and XP system.
  - **psychodelic-trigger-mania.js**: Visual trigger effects with animation controls.
  - **responsive.js**: Responsive design and textarea auto-expansion.
  - **scrapers.js**: Web scraping submission and management.
  - **scrapers-view.js**: Content viewing and display for scraped resources.
  - **system-controls.js**: Centralized state manager for all system features.
  - **text2speech.js**: Text-to-speech client implementation.
  - **trigger-controls.js**: Handles activation/deactivation of trigger words.
- **public/images/**: Visual assets including logos, backgrounds, and animations.
- **public/gif/**: Animated GIF assets for profiles and UI elements.
- **public/audio/**: Audio files used for notifications and effects.

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