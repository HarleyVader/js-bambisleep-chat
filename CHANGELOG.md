# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-10-25

### Added
- **Git Pull Detection System** (`server.js`)
  - Automated deployment detection with graceful shutdown
  - Monitors git commit hash every 30 seconds
  - Notifies connected clients before shutdown
  - Graceful cleanup of workers and connections
  - Prevents stale server instances after deployments
- **Enhanced Dropdown System**
  - View Transitions API integration for smooth animations
  - Advanced keyboard navigation (Arrow keys, Enter, Escape)
  - Smart positioning with viewport boundary detection
  - Auto-repositioning on scroll and resize events
  - Visual feedback animations for user interactions
  - Merged `dropdown-utils.js` into `dropdowns.js` for consolidation

### Changed
- **BREAKING**: Removed Web Speech API fallback (Kokoro-only TTS)
  - Eliminated ~300 lines of legacy compatibility code
  - Simplified TTS system to single backend (Kokoro-FastAPI)
  - Message format standardized to `{display, tts}` objects only
  - Removed legacy string format support
  - Public API: `window.tts.*` methods only (no legacy exports)
- **Major Refactoring**: Console log cleanup (350+ lines removed)
  - Removed redundant initialization logs across 13 files
  - Eliminated verbose state synchronization logs
  - Removed "Source: undefined | Version: undefined" logs
  - Reduced TTS sync attempts from 3 to 1
  - Cleaner console output focused on errors/warnings only
- **Dropdown Race Condition Fix**
  - Removed duplicate click handlers from individual dropdown components
  - Centralized dropdown state management in `DropdownManager`
  - Fixed dropdowns closing immediately after opening (<1 second issue)
  - Improved click detection to distinguish button vs outside clicks
- **File Structure Optimization**
  - Merged `dropdown-utils.js` into `dropdowns.js` (-334 lines, +280 lines)
  - Consolidated all dropdown functionality into single source of truth
  - Removed duplicate initialization calls

### Removed
- Web Speech API fallback system (text2speech.js)
- Legacy TTS format handling (string compatibility)
- Legacy TTS exports (window.do_tts, window.speak, etc.)
- Outdated environment-specific TTS warnings
- `dropdown-utils.js` (merged into dropdowns.js)
- 350+ lines of verbose console logging across codebase

### Fixed
- **Dropdown UX Issues**
  - Dropdowns now stay open until explicitly closed or outside click
  - Eliminated race condition from duplicate event handlers
  - Fixed immediate closure bug (<1 second)
  - Improved click handling for textarea resizing (collar dropdown)
- **Console Output Issues**
  - Removed confusing "undefined" source/version logs
  - Eliminated redundant component availability checks
  - Cleaned up excessive TTS state synchronization messages
  - Reduced initialization log spam (50+ messages → minimal output)

### Security
- 0 vulnerabilities (maintained)
- Improved code maintainability with reduced complexity

### Performance
- Reduced client-side JavaScript by ~350 lines (net)
- Eliminated duplicate event listeners
- Single dropdown initialization instead of dual system
- More efficient keyboard navigation
- Smarter DOM manipulation with View Transitions API

### Technical Details

#### Codebase Changes (since 0.2.0)

| File | Lines Changed | Type |
|------|---------------|------|
| text2speech.js | -332 | Refactor |
| dropdowns.js | +346 | Enhancement |
| dropdown-utils.js | -317 | Removed |
| server.js | +124 | Feature |
| tts-dropdown.js | -57 | Cleanup |
| aigf-core.js | -26 | Cleanup |
| triggers-dropdown.js | -21 | Cleanup |
| spiral-dropdown.js | -20 | Cleanup |
| ai-dropdown.js | -22 | Cleanup |
| effects.js | -11 | Cleanup |
| error-manager.js | -7 | Cleanup |
| **Total** | **-473 insertions, +823 deletions** | **Net: -350 lines** |

#### Git Commits (v0.2.0 → v0.3.0)
- `5587ae8` - Merge dropdown-utils.js into dropdowns.js
- `58df66a` - Remove additional verbose console logs
- `8b3e10a` - Fix dropdown race condition
- `cdf6f03` - Remove redundant console logs (13 files)
- `84dcdf7` - Add git pull detection with graceful shutdown
- `a7065bd` - Remove outdated TTS environment warnings
- `5209faf` - Remove Web Speech API and legacy TTS exports

#### Key Features

**Git Pull Detection:**
```javascript
class GitPullDetector {
  // Monitors: git rev-parse HEAD every 30s
  // Actions: Notify clients → close connections → terminate workers → exit(0)
}
```

**Enhanced Dropdowns:**
- View Transitions API for 60fps animations
- Keyboard navigation: ↑↓ (navigate), Enter (select), Esc (close)
- Smart positioning: Adjusts for viewport boundaries
- Auto-reposition on scroll/resize events
- Visual feedback with CSS animations

**TTS Modernization:**
- Kokoro-FastAPI only (no Web Speech API)
- Unified message format: `{display: "TRIGGER", tts: "trigger"}`
- Public API: `window.tts.speak()`, `window.tts.enable()`, etc.
- Female voices only: af_bella, af_sky, af_nicole, etc.

#### Migration Notes
For projects upgrading from 0.2.0:
1. Web Speech API removed - Kokoro required for TTS
2. Update TTS calls to use `{display, tts}` object format
3. Remove any legacy `window.do_tts()` or `window.speak()` calls
4. Use `window.tts.*` API methods instead
5. Git pull detection active - server auto-restarts on deployments
6. Dropdown system enhanced - no code changes needed
7. Console output significantly cleaner - check for missing logs if debugging

#### Compatibility
- **Minimum Node.js**: 18.0.0 (unchanged)
- **Tested Node.js**: 22.19.0
- **Minimum npm**: 9.0.0 (unchanged)
- **OS**: Windows, Linux, macOS
- **Browser**: Modern browsers with View Transitions API support (progressive enhancement)

---

## [0.2.0] - 2025-10-25

### Added
- GitHub Actions CI/CD workflow (`.github/workflows/test.yml`)
  - Multi-version Node.js testing (18.x, 20.x, 22.x)
  - Multi-platform support (Ubuntu, Windows)
  - Automated test report generation and artifacts
  - Pull request commenting with test results
- Enhanced `.env.example` with comprehensive documentation
- Test report viewer script (`tests/open-report.js`)
  - Cross-platform browser opening
  - Report listing and summary viewing
  - HTML report generation
- CI mode for external service testing
  - `CI=true` environment variable detection
  - Skips external services (Kokoro, LM Studio) in CI
  - Maintains full test coverage in local development
- Comprehensive troubleshooting guide (`tests/TROUBLESHOOTING.md`)
- README badges (GitHub Actions, Node.js version)
- Implementation summary documentation (`IMPLEMENTATION_SUMMARY.md`)
- Upgrade summary documentation (`UPGRADE-SUMMARY.md`)
- Engine requirements in `package.json` (Node >=18.0.0, npm >=9.0.0)

### Changed
- **BREAKING**: Upgraded Express from 4.21.2 to 5.1.0
  - No breaking changes affecting codebase
  - Improved performance and security
- **BREAKING**: Migrated from `node-fetch` to Node.js native `fetch()`
  - Removed `node-fetch` dependency (6 packages removed)
  - Updated `workers/kokoro.js` to use native fetch
  - Requires Node 18+ (native fetch API)
- Upgraded `cross-env` from 7.0.3 to 10.1.0
- Upgraded `rimraf` from 5.0.10 to 6.0.1
- Bumped version from 0.1.0 to 0.2.0
- Updated package.json scripts:
  - Added `test:ci` - Run tests in CI mode
  - Added `test:report` - Open latest test report
  - Added `test:view` - View test reports (alias)

### Fixed
- Node-fetch 3.x ESM compatibility issues
  - Replaced with native fetch API
  - Eliminated ESM/CommonJS conflicts
- External service test failures in CI environments
  - Stability tests now skip server startup in CI mode
  - Environment and resource tests remain comprehensive
- Deprecated dependency warnings
  - Removed `node-domexception@1.0.0` (transitive from node-fetch)
  - Removed `data-uri-to-buffer`, `fetch-blob`, `formdata-polyfill`, `web-streams-polyfill`

### Removed
- `node-fetch` dependency (replaced with native fetch)
- 6 transitive dependencies from node-fetch removal

### Security
- 0 vulnerabilities (maintained)
- Reduced attack surface (6 fewer dependencies)
- Updated to latest secure versions of all dependencies

### Technical Details

#### Dependency Changes

| Package | Old Version | New Version | Type |
|---------|-------------|-------------|------|
| express | 4.21.2 | 5.1.0 | MAJOR |
| node-fetch | 2.7.0 | REMOVED | MAJOR |
| cross-env | 7.0.3 | 10.1.0 | MAJOR |
| rimraf | 5.0.10 | 6.0.1 | MAJOR |

#### Test Results
- Environment Tests: 20✅ 0❌ 0⚠️ (PASS)
- Stability Tests: 5✅ 0❌ 0⚠️ (PASS)
- Resource Tests: 9✅ 3❌ 0⚠️ (Expected - CPU monitoring limitation)
- Overall: 36✅ 3❌ 4⚠️

#### Compatibility
- **Minimum Node.js**: 18.0.0 (for native fetch)
- **Tested Node.js**: 18.x, 20.x, 22.19.0
- **Minimum npm**: 9.0.0
- **OS**: Windows, Linux, macOS

#### Migration Notes
For projects upgrading from 0.1.0:
1. Ensure Node.js >= 18.0.0 installed
2. Run `npm install` to update dependencies
3. No code changes required (Express 5.x compatible)
4. Kokoro worker now uses native fetch (no changes needed)
5. Review `.env.example` for new environment variable documentation

---

## [0.1.0] - 2024-XX-XX

### Added
- Initial release
- Express + Socket.io server
- Kokoro TTS integration (worker thread)
- LM Studio AI chat integration (worker thread)
- BambiSleep trigger system
- Real-time chat with trigger detection
- Psychedelic visual effects
- Spiral animations
- Brainwave audio integration
- Comprehensive test suite
  - Environment validation tests
  - Stability and load tests
  - Resource usage monitoring
- Vite development server with proxy
- ES6 modular frontend architecture
- Dropdown UI components
- Mobile interface support
- Error management system
- Storage utilities

### Technical Stack
- Backend: Node.js, Express 4.x, Socket.io 4.x
- Frontend: Vanilla JavaScript ES6 modules
- Build: Vite
- Testing: Custom test orchestrator
- TTS: Kokoro-FastAPI (external service)
- AI: LM Studio (external service)

---

[0.3.0]: https://github.com/HarleyVader/js-bambisleep-chat/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/HarleyVader/js-bambisleep-chat/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/HarleyVader/js-bambisleep-chat/releases/tag/v0.1.0
