# BambiSleep Chat - Development TODO

**Last Updated**: October 31, 2025  
**Version**: v0.3.0  
**Status**: Production-ready with comprehensive testing framework

---

## 🎯 Current Status Summary

### ✅ Completed Major Features (v0.3.0)

- **Centralized Environment Configuration** (`src/config/env.js`) - Production/development host selection
- **Worker Thread Architecture** - Kokoro TTS + LM Studio AI in dedicated threads
- **Unified Test Framework v3.0** - Zero-dependency custom test runner (32 tests)
- **Git Pull Detection System** - Auto-restart on deployments
- **React + Vite Development Mode** - Dual-server setup with HMR
- **Comprehensive Copilot Instructions** - 1,500+ lines of AI agent guidance
- **Dropdown System Refactor** - Centralized state management, race condition fix
- **TTS System Simplification** - Kokoro-only (removed Web Speech API fallback)

### 📊 Quality Metrics

- **Test Coverage**: 32 test suites with 96%+ pass rate target
- **Build System**: 7-step production workflow with validation
- **Documentation**: 5 comprehensive MD files (README, WORKFLOWS, BUILD, CHANGELOG, MCP-SETUP)
- **Scripts**: 5 production scripts (build, deploy, clean, validate-service)

---

## 🚀 High Priority (Production Enhancement)

### 🔧 Infrastructure & Performance

- [ ] **Implement Redis Session Store** - Replace in-memory session management
  - File: `src/workers/lmstudio.js` (SessionManager class)
  - Benefit: Persistent sessions across server restarts
  - Complexity: Medium (2-4 hours)
- [ ] **Add Rate Limiting Middleware** - Prevent abuse on Socket.io events

  - File: `src/server/server.js` (Socket.io connection handler)
  - Benefit: DDoS protection, resource management
  - Complexity: Low (1-2 hours)

- [ ] **Implement Message Queue** - Bull/BeeQueue for worker task management
  - Files: `src/workers/kokoro.js`, `src/workers/lmstudio.js`
  - Benefit: Better load balancing, retry logic
  - Complexity: High (4-8 hours)

### 🧪 Testing & Quality

- [ ] **Add E2E Tests** - Playwright/Cypress for full workflow testing

  - New directory: `tests/e2e/`
  - Tests: User flow, chat history, TTS integration, AI chat
  - Complexity: High (8-12 hours)

- [ ] **Implement Performance Tests** - Load testing for concurrent connections

  - File: `tests/performance-load.test.js`
  - Target: 100+ concurrent users, <100ms response time
  - Complexity: Medium (3-5 hours)

- [ ] **Add Integration Tests** - Worker communication, API endpoints
  - File: `tests/integration-v2.test.js`
  - Coverage: Socket.io events, worker messages, API responses
  - Complexity: Medium (4-6 hours)

### 📚 Documentation

- [ ] **Create API Documentation** - OpenAPI/Swagger spec

  - File: `docs/api-spec.yaml`
  - Endpoints: All REST and Socket.io events
  - Complexity: Low (2-3 hours)

- [ ] **Add Architecture Diagrams** - System flow visualizations
  - Files: `docs/architecture/` (SVG/PNG diagrams)
  - Diagrams: Worker threads, Socket.io flow, React components
  - Complexity: Low (2-4 hours)

---

## 🎨 Medium Priority (Feature Enhancement)

### 🌟 Frontend Features

- [ ] **Add User Authentication** - JWT-based login system

  - Files: `src/server/auth.js`, `src/client/context/AuthContext.jsx`
  - Features: Login/logout, profile management, session persistence
  - Complexity: High (12-16 hours)

- [ ] **Implement Chat Rooms** - Multiple conversation channels

  - Files: `src/server/server.js` (room management), `src/client/components/RoomList.jsx`
  - Features: Create/join rooms, private messages, room persistence
  - Complexity: High (10-14 hours)

- [ ] **Add Rich Text Editor** - Markdown/formatting support

  - File: `src/client/components/MessageInput.jsx`
  - Library: Draft.js or Slate.js
  - Complexity: Medium (4-6 hours)

- [ ] **Implement File Sharing** - Image/document uploads
  - Files: `src/server/upload.js`, `src/client/components/FileUpload.jsx`
  - Storage: Local filesystem or S3-compatible
  - Complexity: High (8-12 hours)

### 🤖 AI & TTS Enhancements

- [ ] **Add Voice Cloning** - Custom TTS voices via Kokoro

  - File: `src/workers/kokoro.js`
  - Feature: Upload voice samples, train models
  - Complexity: Very High (16-24 hours)

- [ ] **Implement AI Personalities** - Configurable LM Studio personas

  - File: `src/workers/lmstudio.js` (system prompts)
  - Feature: Select from preset personalities or create custom
  - Complexity: Medium (4-6 hours)

- [ ] **Add Speech-to-Text** - Voice input for messages
  - Files: `src/workers/stt.js` (new worker), client microphone capture
  - API: Whisper.cpp or browser Web Speech API
  - Complexity: High (10-14 hours)

### 🎭 Animation & Effects

- [ ] **Add Custom Trigger Animations** - User-defined visual effects

  - File: `src/client/components/AnimationEditor.jsx`
  - Feature: Create custom p5.js animations for trigger words
  - Complexity: Very High (16-20 hours)

- [ ] **Implement Theme System** - Dark/light/custom color schemes
  - Files: `src/client/context/ThemeContext.jsx`, CSS variables
  - Feature: Theme switcher, CSS variable management
  - Complexity: Medium (3-5 hours)

---

## 🔧 Low Priority (Technical Debt & Optimization)

### 🧹 Code Quality

- [ ] **Migrate to TypeScript** - Gradual conversion of JS files

  - Start with: `src/config/env.js`, `src/workers/`
  - Benefit: Type safety, better IDE support
  - Complexity: Very High (40-60 hours)

- [ ] **Implement ESLint + Prettier** - Consistent code style

  - Files: `.eslintrc.js`, `.prettierrc`
  - Rules: Airbnb or Standard style guide
  - Complexity: Low (1-2 hours)

- [ ] **Add JSDoc Comments** - Documentation for all public APIs
  - Files: All `src/` files
  - Coverage: Functions, classes, modules
  - Complexity: Medium (8-12 hours)

### 📦 Build & Deployment

- [ ] **Docker Containerization** - Dockerfile + docker-compose

  - Files: `Dockerfile`, `docker-compose.yml`
  - Services: Node.js app, Redis, MongoDB (optional)
  - Complexity: Medium (4-6 hours)

- [ ] **CI/CD Pipeline** - GitHub Actions workflows

  - File: `.github/workflows/ci.yml`
  - Jobs: Test, build, deploy, security audit
  - Complexity: Medium (3-5 hours)

- [ ] **CDN Integration** - CloudFlare/Fastly for static assets
  - Files: `vite.config.js` (asset URL configuration)
  - Benefit: Faster load times, reduced server load
  - Complexity: Low (2-3 hours)

### 🔒 Security

- [ ] **Implement Content Security Policy** - CSP headers

  - File: `src/server/server.js` (helmet middleware)
  - Protection: XSS, injection attacks
  - Complexity: Low (1-2 hours)

- [ ] **Add Input Sanitization** - DOMPurify integration

  - Files: `src/server/server.js`, `src/client/utils/sanitize.js`
  - Sanitize: User messages, trigger inputs
  - Complexity: Low (2-3 hours)

- [ ] **Implement HTTPS** - SSL/TLS certificate setup
  - Files: `bambisleepchat.service` (systemd), Nginx/Apache config
  - Certificate: Let's Encrypt or custom
  - Complexity: Low (1-2 hours)

---

## 🐛 Known Issues & Bugs

### High Priority Fixes

- [ ] **Worker Thread Memory Leak** - LM Studio session cleanup incomplete

  - File: `src/workers/lmstudio.js` (SessionManager)
  - Symptom: Memory growth over 24+ hours
  - Fix: Improve cleanup interval, add manual GC trigger

- [ ] **Socket.io Reconnection Loop** - Client reconnects infinitely on server error
  - File: `src/client/hooks/useSocket.js`
  - Symptom: Rapid reconnection attempts after server crash
  - Fix: Exponential backoff, max retry limit

### Medium Priority Fixes

- [ ] **Vite HMR Fails on Worker Changes** - Dev server doesn't detect worker file updates

  - File: `vite.config.js`
  - Symptom: Requires manual server restart for worker changes
  - Fix: Add worker files to watch list

- [ ] **Test Runner Timeout on Slow Systems** - 300s timeout too short for CI
  - File: `tests/unified-test-runner.js`
  - Symptom: Tests fail on GitHub Actions free tier
  - Fix: Configurable timeout via environment variable

### Low Priority Fixes

- [ ] **Console Warning: React Key Props** - Missing keys in mapped components
  - Files: Various `src/client/components/` files
  - Symptom: Dev console warnings
  - Fix: Add unique key props to all .map() renders

---

## 📋 Feature Requests (Community/User Driven)

### Requested Features

- [ ] **Mobile App** - React Native version
- [ ] **Discord Bot Integration** - Bridge chat to Discord
- [ ] **Twitch Extension** - Trigger words from stream chat
- [ ] **VR/AR Support** - WebXR integration for immersive experience
- [ ] **Blockchain Integration** - NFT triggers, crypto payments
- [ ] **AI Voice Training** - User-uploaded voice samples for TTS

---

## 🔄 Migration & Upgrade Paths

### Planned Upgrades

- [ ] **Node.js 22 LTS** - Upgrade from Node 20 (when LTS released)
- [ ] **Express 6** - When stable (currently v5.1.0)
- [ ] **Socket.io 5** - Major version upgrade
- [ ] **React 19** - When stable (currently v18.3.1)
- [ ] **Vite 8** - Next major version

### Breaking Changes Preparation

- [ ] **Document v0.3.x → v1.0.0 migration** - Breaking changes guide
- [ ] **Create legacy support branch** - Maintain v0.3.x for 6 months
- [ ] **Deprecation warnings** - Add console warnings for deprecated APIs

---

## 📖 Documentation Improvements

### Missing Documentation

- [ ] **Deployment Guide** - Step-by-step production deployment
- [ ] **Troubleshooting Guide** - Common issues and solutions
- [ ] **Contributing Guide** - PR templates, code style, commit conventions
- [ ] **Security Policy** - Vulnerability reporting process

### Documentation Quality

- [ ] **Add Code Examples** - More inline examples in README
- [ ] **Video Tutorials** - YouTube walkthrough of features
- [ ] **FAQ Section** - Common questions and answers
- [ ] **Changelog Improvements** - More detailed breaking changes

---

## 🎓 Learning & Research

### Technology Exploration

- [ ] **WebRTC Integration** - Peer-to-peer voice/video chat
- [ ] **WebAssembly** - Performance-critical code (animations, audio processing)
- [ ] **Server-Sent Events** - Alternative to Socket.io for one-way updates
- [ ] **GraphQL** - Alternative to REST API
- [ ] **Bun Runtime** - Evaluate as Node.js replacement

### Performance Research

- [ ] **Benchmark Worker Threads vs Cluster** - Optimal concurrency model
- [ ] **Evaluate Alternative TTS APIs** - Cost/quality comparison with Kokoro
- [ ] **LM Studio vs Local LLM Alternatives** - Ollama, LlamaCPP, vLLM

---

## 📊 Metrics & Monitoring

### To Implement

- [ ] **Application Metrics** - Prometheus + Grafana
  - Metrics: Request rate, response time, error rate, user count
- [ ] **Error Tracking** - Sentry or Rollbar integration
  - Capture: Client errors, server errors, worker crashes
- [ ] **Usage Analytics** - Plausible or self-hosted analytics
  - Track: Page views, user flows, feature usage
- [ ] **Performance Monitoring** - New Relic or AppSignal
  - Monitor: Server resources, database queries, API latency

---

## 🤝 Community & Ecosystem

### Community Building

- [ ] **GitHub Discussions** - Enable Q&A forum
- [ ] **Discord Server** - Community chat and support
- [ ] **Bug Bounty Program** - Security vulnerability rewards
- [ ] **Contributor Recognition** - Hall of fame, badges

### Ecosystem Projects

- [ ] **Plugin System** - Allow third-party extensions
- [ ] **Theme Marketplace** - Community-created themes
- [ ] **Trigger Pack Repository** - Shared trigger word collections
- [ ] **Integration Library** - Pre-built integrations (Slack, Teams, etc.)

---

## 💡 Innovation & Experiments

### Experimental Features (Research Phase)

- [ ] **AI-Generated Animations** - Stable Diffusion for trigger visuals
- [ ] **Biometric Integration** - Heart rate, EEG triggers
- [ ] **Spatial Audio** - 3D positional audio for messages
- [ ] **Haptic Feedback** - Vibration patterns for triggers
- [ ] **Eye Tracking** - Gaze-based interaction

---

## 📝 Notes

### Development Principles

1. **Test-Driven Development** - Write tests before features
2. **Graceful Degradation** - Features fail safely
3. **Performance First** - Optimize critical paths
4. **Security By Design** - Consider security from day one
5. **User Experience** - Intuitive, accessible, responsive

### Code Review Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console.logs in production code
- [ ] Environment variables in `.env.example`
- [ ] Error handling implemented
- [ ] Performance impact assessed

---

**Legend**:

- 🚀 High Priority
- 🎨 Medium Priority
- 🔧 Low Priority
- 🐛 Bug Fix
- 📚 Documentation
- 🧪 Testing
- 🔒 Security
- 💡 Experimental

**For Contributors**: See `.github/copilot-instructions.md` for comprehensive development guide.
