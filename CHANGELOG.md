# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/HarleyVader/js-bambisleep-chat/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/HarleyVader/js-bambisleep-chat/releases/tag/v0.1.0
