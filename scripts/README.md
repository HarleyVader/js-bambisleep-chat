# Scripts Directory

Utility scripts for BambiSleep Chat development and maintenance.

## clean.js v2.0

Enhanced cleaning script with multiple levels and comprehensive artifact removal.

### Usage

```bash
# Standard clean (recommended)
npm run clean

# Light clean (test reports only)
npm run clean:light

# Full clean (everything including node_modules)
npm run clean:full

# Direct script usage with options
node scripts/clean.js [--light|--full|--help]
```

### Clean Levels

#### Light Clean (`--light`)
- 🧹 Test reports and summaries
- 📄 Temporary files (`tests/.write-test-temp`)
- ⚡ Fast execution, preserves all dependencies

**Cleans:**
- `tests/reports/unified-test-report-*.html`
- `tests/reports/unified-test-report-*.json`
- `tests/reports/latest-unified-summary.txt`
- `tests/reports/unified-test-summary.txt`
- `tests/reports/ci-test-results.json`
- Legacy report formats (`bambisleep-*.html/json`)

#### Standard Clean (default)
- ✅ Everything from Light Clean
- 🏗️ Build artifacts and cache
- 📊 Vite cache (`.vite/`)
- 📈 Coverage reports (`coverage/`)

**Additional cleanup:**
- `public/dist/` (build output)
- `.vite/` (Vite cache)
- `coverage/` (test coverage reports)
- Cache files (`.DS_Store`, `Thumbs.db`, `*.tmp`, `*.log`)

#### Full Clean (`--full`)
- ✅ Everything from Standard Clean
- 📦 Dependencies (`node_modules/`)
- 🔒 Lock files (`package-lock.json`)
- 🚨 Requires `npm install` afterward

**Complete reset:**
- All build artifacts and cache
- All test reports and temporary files
- All dependencies and lock files
- System cache files across project

### Features

#### Smart Detection
- ✓ Unified Test Framework v2.0 reports
- ✓ Legacy test report formats
- ✓ Cross-platform cache files (macOS, Windows, Linux)
- ✓ Temporary and log files

#### Enhanced Reporting
- 📊 File size information
- 📈 Operation statistics
- ⏱️ Execution timing
- 🚨 Error handling and reporting

#### Safety Features
- 🛡️ Preserves source code and configuration
- 🔍 Detailed operation logging
- ⚠️ Graceful error handling
- 💡 Next-steps guidance

### Examples

```bash
# Quick cleanup after testing
npm run clean:light

# Prepare for fresh build
npm run clean

# Complete project reset
npm run clean:full && npm install

# Show help and options
node scripts/clean.js --help
```

### Integration

The clean script integrates seamlessly with:
- **Unified Test Framework v2.0** - Handles all test report formats
- **Vite Development Server** - Cleans build cache and artifacts
- **Node.js Project Structure** - Respects modern project conventions
- **CI/CD Pipelines** - Provides reliable reset functionality

## deploy.js

Production deployment script for Linux systemd environments.

### Usage

```bash
# Install service for first time
npm run deploy:install

# Update existing service
npm run deploy:update

# Check service status
npm run deploy:status

# Monitor logs
npm run deploy:logs

# Direct script usage
node scripts/deploy.js [command]
```

### Commands

```bash
install      # Fresh systemd service installation
update       # Update service configuration and restart
start        # Start the service
stop         # Stop the service
restart      # Restart the service
status       # Show detailed service status
logs         # Show recent application logs
uninstall    # Complete service removal
validate     # Validate deployment environment
help         # Show detailed help information
```

### Features

#### Production-Ready Configuration
- ✅ **Security Hardening** - PrivateTmp, NoNewPrivileges, ProtectSystem
- ✅ **Resource Limits** - Memory (2GB), CPU weight, file descriptors
- ✅ **Health Monitoring** - Watchdog timer, restart policies
- ✅ **Graceful Shutdown** - SIGTERM handling with 30s timeout

#### Pre-Deployment Validation
- 🔍 **Environment Checks** - Node.js version, systemd availability
- 🔍 **File Validation** - server.js, package.json, config directory
- 🔍 **Dependency Installation** - `npm ci --production`
- 🔍 **Critical Tests** - Runs test suite before startup

#### Enhanced Monitoring
- 📊 **Structured Logging** - Systemd journal integration
- 📊 **Service Health** - Automatic restart on failure
- 📊 **Resource Tracking** - Memory and CPU monitoring
- 📊 **Log Management** - Centralized logging with syslog identifier

### Production Environment

The systemd service is configured for:
- **User:** brandynette
- **Working Directory:** `/home/brandynette/web/bambisleep.chat/js-bambisleep-chat`
- **Port:** 7878
- **Environment:** NODE_ENV=production
- **Resources:** 2GB memory limit, 65536 file descriptors

### Security Features

- **Filesystem Protection** - Read-only system, private tmp
- **Privilege Restrictions** - No new privileges, restricted paths
- **Process Isolation** - Dedicated user/group, controlled environment
- **Resource Limits** - CPU/memory constraints prevent resource exhaustion

### Integration

Works seamlessly with:
- **BambiSleep Chat v0.3.0** - Full application lifecycle management
- **Unified Test Framework** - Pre-deployment validation
- **Clean Script** - Deployment environment preparation
- **Linux systemd** - Native service management integration

## validate-service.js

Validation script to ensure systemd service aligns with package.json requirements.

### Usage

```bash
# Validate service configuration
npm run validate-service

# Direct script usage
node scripts/validate-service.js
```

### Validation Checks

#### Package.json Integration
- ✅ **Node.js Requirements** - Validates engines specification alignment
- ✅ **Script Integration** - Ensures service uses package.json scripts
- ✅ **Modern Standards** - Checks Volta, packageManager, funding metadata
- ✅ **Version Compatibility** - Validates npm and pnpm requirements

#### Service Configuration
- ✅ **Pre-startup Validation** - Node.js/npm version checks
- ✅ **Health Check Integration** - Uses package.json health-check script
- ✅ **Security Hardening** - PrivateTmp, NoNewPrivileges, ProtectSystem
- ✅ **Resource Limits** - Memory, CPU, file descriptor limits
- ✅ **Environment Setup** - NODE_ENV, PORT, NODE_OPTIONS validation

#### Production Readiness
- ✅ **Deployment Alignment** - Service matches package.json engines
- ✅ **Script Execution** - Uses npm run health-check for validation
- ✅ **Error Detection** - Identifies misaligned configurations
- ✅ **Best Practices** - Validates enterprise-grade service setup

The validation script ensures complete alignment between package.json modern standards and systemd service enterprise configuration.
