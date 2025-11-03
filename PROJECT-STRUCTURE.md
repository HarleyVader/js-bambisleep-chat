# Project Structure

## Root Directory

```
js-bambisleep-chat/
├── README.md                        # Main project documentation
├── CHANGELOG.md                     # Version history
├── TODO.md                          # Project roadmap
├── CONSOLIDATION-FINAL-REPORT.md    # Codebase consolidation report
├── package.json                     # Dependencies & scripts
├── vite.config.js                   # Vite build configuration
├── bambisleepchat.service          # Systemd service file
├── install.sh / install.ps1        # Installation scripts
│
├── .github/                        # GitHub configuration
│   └── copilot-instructions.md     # AI coding agent instructions
│
├── docs/                           # Technical documentation
│   ├── README.md                   # Documentation index
│   ├── BUILD.md                    # Build system guide
│   ├── WORKFLOWS.md                # Development workflows
│   └── MCP-SETUP.md                # MCP integration setup
│
├── src/                            # Source code (not present - using public/)
│
├── public/                         # Frontend assets & code
│   ├── index.html                  # Main HTML
│   ├── css/                        # Stylesheets
│   ├── js/                         # JavaScript modules
│   │   ├── dropdowns/             # Dropdown components
│   │   │   ├── base-dropdown.js   # Base class (NEW)
│   │   │   ├── ai-dropdown.js     # AI mode dropdown
│   │   │   ├── tts-dropdown.js    # TTS dropdown
│   │   │   ├── triggers-dropdown.js
│   │   │   ├── spiral-dropdown.js
│   │   │   ├── collar-dropdown.js
│   │   │   └── brainwave-dropdown.js
│   │   ├── chat.js                # Chat functionality
│   │   ├── text2speech.js         # TTS integration
│   │   ├── triggers.js            # Trigger system
│   │   ├── brainwave.js           # Brainwave generator
│   │   ├── animation-controller.js
│   │   └── psychodelic-trigger-mania.js
│   └── docs/                      # User-facing guides
│       ├── README.md
│       ├── AIGF-AI-MODE-GUIDE.md
│       ├── BAMBI-TRIGGERS-GUIDE.md
│       ├── BRAINWAVE-BEATS-GUIDE.md
│       ├── COLLAR-SETTINGS-GUIDE.md
│       ├── DEPLOYMENT.md
│       ├── SPIRAL-CONTROLS-GUIDE.md
│       ├── TRIGGERS-SYSTEM-GUIDE.md
│       ├── TROUBLESHOOTING.md
│       └── TTS-VOICE-GUIDE.md
│
├── scripts/                        # Build & deployment scripts
│   ├── README.md
│   ├── build.js                   # Production build
│   ├── deploy.js                  # Deployment automation
│   ├── clean.js                   # Cleanup utility
│   └── validate-service.js        # Service validation
│
└── tests/                         # Test suites
    ├── README.md
    ├── unified-test-runner.js     # Test runner
    ├── unified-test-framework.js  # Test framework
    ├── architecture-v2.test.js
    ├── environment-v2.test.js
    ├── stability-v2.test.js
    ├── performance-benchmark.test.js
    ├── mcp-tools-unified.test.js  # MCP integration tests
    └── reports/                   # Test reports (gitignored)
        ├── README.md
        └── latest-unified-summary.txt
```

## Key Architecture Components

### Backend (Not in this structure - uses Express server)
- Server code would be in `src/server/`
- Worker threads would be in `src/workers/`
- Configuration in `src/config/`

### Frontend (public/)
- **HTML/CSS**: Standard structure with CSS layers
- **JavaScript**: ES6 modules with centralized patterns
- **Dropdowns**: All extend `BaseDropdown` class
- **State Management**: Centralized via `dropdownManager`

### Build System (scripts/)
- Production build with Vite
- Deployment automation
- Service management

### Testing (tests/)
- Custom unified test framework
- Architecture validation
- Performance benchmarks
- MCP integration tests

## Recent Consolidation (Nov 2025)

- Created `BaseDropdown` class (172 lines)
- Refactored 6 dropdown components to extend base class
- Merged duplicate MCP test files (965→403 lines, 58% reduction)
- Eliminated ~672 lines of duplicate code
- Organized documentation structure

## Documentation Organization

| Location | Purpose |
|----------|---------|
| Root | User-facing: README, CHANGELOG, TODO |
| docs/ | Technical: BUILD, WORKFLOWS, MCP-SETUP |
| public/docs/ | User guides & troubleshooting |
| tests/ | Testing framework documentation |
| scripts/ | Build/deployment documentation |

---

**Last Updated:** November 3, 2025
