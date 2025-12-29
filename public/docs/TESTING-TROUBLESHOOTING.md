# BambiSleep Chat - Testing Troubleshooting Guide

This guide helps you resolve common issues when running the test suite.

## Table of Contents
- [Environment Test Failures](#environment-test-failures)
- [Stability Test Failures](#stability-test-failures)
- [Resource Test Failures](#resource-test-failures)
- [CI/CD Issues](#cicd-issues)
- [External Service Issues](#external-service-issues)
- [Platform-Specific Issues](#platform-specific-issues)

---

## Environment Test Failures

### ❌ Node.js version below requirement

**Error:** `Node.js vX.X.X below requirement (>=18)`

**Solution:**
```bash
# Check your Node version
node --version

# Update Node.js to v18 or higher
# Visit https://nodejs.org/ or use a version manager:
nvm install 18
nvm use 18
```

### ❌ Missing dependencies

**Error:** `✗ Missing dependency: express` (or other packages)

**Solution:**
```bash
# Reinstall all dependencies
npm install

# If that fails, clean and reinstall
npm run clean
npm install
```

### ❌ Missing critical files

**Error:** `✗ Missing critical file: server.js`

**Solution:**
- Ensure you're in the project root directory
- Check that you've cloned the complete repository
- Verify file permissions

### ❌ Port already in use

**Error:** `Port 6969 (Backend Server) already in use`

**Solution:**
```bash
# Windows - find and kill process using port
netstat -ano | findstr :6969
taskkill /PID <process_id> /F

# Linux/macOS
lsof -ti:6969 | xargs kill -9

# Or use a different port in .env
PORT=6970
```

### ⚠️ Environment variables not configured

**Warning:** `Optional env vars configured: 0/7`

**Solution:**
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and configure your settings
# At minimum, set these for full functionality:
# - KOKORO_HOST_DEVELOPMENT
# - KOKORO_PORT
# - LMS_HOST_DEVELOPMENT
# - LMS_PORT
```

---

## Stability Test Failures

### ❌ Server startup timeout

**Error:** `Server startup timeout - assuming success`

**Causes:**
- Server dependencies taking too long to load
- Port conflicts
- Missing external services (Kokoro TTS, LM Studio)

**Solutions:**

1. **Check server logs manually:**
```bash
node server.js
# Look for error messages
```

2. **Increase timeout (if needed):**
Edit `tests/stability.test.js`:
```javascript
// Change from 10000 to 15000
setTimeout(() => {
    // ...
}, 15000);
```

3. **Run without external services:**
```bash
# Use CI mode to skip external service tests
npm run test:ci
```

### ❌ WebSocket connection failures

**Error:** `Concurrent connections: 0/10`

**Causes:**
- Socket.io not properly configured
- CORS issues
- Server not fully started

**Solutions:**

1. **Check CORS configuration in server.js:**
```javascript
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});
```

2. **Test WebSocket manually:**
```bash
# Install wscat if needed
npm install -g wscat

# Test connection
wscat -c ws://localhost:6969/socket.io/?EIO=4&transport=websocket
```

### ❌ HTTP connectivity failures

**Error:** `✗ http://localhost:6969 failed: ECONNREFUSED`

**Causes:**
- Server not running
- Wrong port
- Firewall blocking connection

**Solutions:**

1. **Verify server is running:**
```bash
# Check if port is listening
netstat -an | findstr :6969  # Windows
lsof -i :6969                # Linux/macOS
```

2. **Check firewall:**
```bash
# Windows - allow Node through firewall
# Control Panel → Windows Defender Firewall → Allow an app

# Linux
sudo ufw allow 6969
```

### ⚠️ Memory growth warnings

**Warning:** `Memory growth: 51.2 MB`

**Causes:**
- Memory leak in application code
- Long-running processes not cleaned up
- Too many connections retained

**Solutions:**

1. **Review worker thread cleanup:**
Check that workers are properly terminated in `server.js`

2. **Monitor in production:**
```bash
# Use Node's built-in profiler
node --inspect server.js

# Open Chrome DevTools → Memory profiler
```

---

## Resource Test Failures

### ❌ Insufficient CPU data collected

**Error:** `Insufficient CPU data collected`

**Causes:**
- Tests running too fast
- Windows CPU monitoring limitations
- High system load

**Solutions:**

1. **This is often a non-critical warning** - tests run quickly
2. **Increase monitoring duration:**
Edit `tests/resource.test.js`:
```javascript
const testDuration = 20000; // Increase from 15000
```

3. **Run on Linux/macOS for better metrics:**
```bash
# Linux has better CPU profiling support
```

### ⚠️ Port test timeout

**Warning:** `Port 5173 test timeout`

**Causes:**
- Services already running on ports
- Network slowness
- Firewall interference

**Solutions:**

1. **These timeouts are often harmless** - just means something is using the port
2. **To fix, free the ports:**
```bash
# Stop all development servers before testing
npm run test
```

### ❌ High memory usage

**Error:** `Average memory usage: 520 MB` (threshold: 500 MB)

**Solutions:**

1. **Close other applications** during testing
2. **Increase threshold if your system has plenty of RAM:**
Edit `tests/resource.test.js`:
```javascript
avgMemMB < 600 ? 'pass' : 'warn'  // Increase from 500
```

---

## CI/CD Issues

### ❌ GitHub Actions failing

**Error:** Tests pass locally but fail in CI

**Common causes:**

1. **Missing environment variables:**
```yaml
# Add to .github/workflows/test.yml
env:
  CI: true
  NODE_ENV: test
```

2. **External services unavailable:**
```bash
# Use CI mode to skip external tests
npm run test:ci
```

3. **Timeout issues in CI:**
CI environments are often slower. Adjust timeouts:
```yaml
# In workflow file
timeout-minutes: 15  # Increase if needed
```

### ❌ Artifact upload fails

**Error:** `No files found in tests/reports/`

**Solutions:**

1. **Ensure reports directory exists:**
```yaml
- name: Create reports directory
  run: mkdir -p tests/reports
```

2. **Check test execution:**
```yaml
- name: Run tests
  run: npm test
  continue-on-error: true  # Generate reports even on failure
```

---

## External Service Issues

### 🔇 Kokoro TTS not available

**Error:** `🎤 Kokoro API or worker not configured, TTS routes will return 503`

**This is normal if you don't have Kokoro TTS running.**

**Solutions:**

1. **Run without TTS (app still works):**
- TTS features will be disabled
- Chat and other features work normally

2. **Install Kokoro TTS locally:**
```bash
# Follow Kokoro installation guide
# Set in .env:
KOKORO_HOST_DEVELOPMENT=http://localhost
KOKORO_PORT=8880
```

3. **Run tests in CI mode:**
```bash
npm run test:ci  # Skips external services
```

### 🤖 LM Studio not available

**Error:** `❌ Error fetching models: Error`

**This is normal if you don't have LM Studio running.**

**Solutions:**

1. **Run without AI (app still works):**
- AI chat features will be disabled
- Regular chat and features work normally

2. **Install LM Studio:**
- Download from <https://lmstudio.ai/>
- Load a model
- Set in .env:
```bash
LMS_HOST_DEVELOPMENT=http://localhost
LMS_PORT=1234
```

3. **Configure test to skip AI tests:**
```bash
CI=true npm test
```

---

## Platform-Specific Issues

### Windows

**PowerShell script execution:**
```powershell
# If you get execution policy errors
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

**Path separators:**
- Tests use `path.join()` which handles Windows paths correctly
- If you see issues, check for hardcoded `/` paths

**File handle monitoring:**
```
File handle monitoring limited on Windows
```
This is expected - Windows doesn't expose file descriptors like Unix.

### Linux/macOS

**Permission issues:**
```bash
# Make sure test files are executable
chmod +x tests/*.test.js

# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
```

**Node version:**
```bash
# Use nvm for easy version management
nvm install 18
nvm use 18
nvm alias default 18
```

---

## Quick Diagnostic Checklist

Before asking for help, try these steps:

✅ **Basic checks:**
```bash
# 1. Verify Node version
node --version  # Should be >= 18

# 2. Check dependencies
npm list --depth=0

# 3. Run environment test only
npm run test:env

# 4. Check for port conflicts
netstat -an | findstr :6969  # Windows
lsof -i :6969                # Linux/macOS

# 5. Try CI mode
npm run test:ci
```

✅ **Clean reinstall:**
```bash
npm run clean
npm install
npm test
```

✅ **Check logs:**
```bash
# Run server manually to see errors
node server.js

# Check test output
npm test > test-output.log 2>&1
```

---

## Getting Help

If you've tried the above solutions and still have issues:

1. **Check existing issues:** <https://github.com/HarleyVader/js-bambisleep-chat/issues>

2. **Create a new issue with:**
   - Test output (from `tests/reports/latest-summary.txt`)
   - Node version: `node --version`
   - OS: Windows/Linux/macOS
   - Steps you've already tried

3. **Include test logs:**
```bash
npm test 2>&1 | tee test-debug.log
```

---

## Test Report Analysis

### Understanding test output:

```
✅ ENVIRONMENT: PASS (20✅ 0❌ 0⚠️)
   All environment requirements met

❌ STABILITY: FAIL (9✅ 3❌ 1⚠️)
   Some stability issues - review recommended

⚠️ RESOURCE: PASS (8✅ 0❌ 2⚠️)
   Passes but has warnings - monitoring recommended
```

**Priority levels:**
- ❌ **Failed environment tests:** Critical - fix before deployment
- ❌ **Failed stability tests:** Important - app may crash under load
- ❌ **Failed resource tests:** Warning - may have performance issues
- ⚠️ **Warnings:** Review recommended but not blocking

### View detailed reports:

```bash
# Open HTML report in browser
npm run test:report

# View text summary
cat tests/reports/latest-summary.txt

# List all reports
npm run test:report -- --list
```

---

## Contributing Test Improvements

Found a bug in the tests? Want to improve coverage?

1. Fork the repository
2. Create a feature branch: `git checkout -b test/improvement`
3. Make your changes in `tests/` directory
4. Run tests: `npm test`
5. Submit a pull request

All test improvements welcome! 🎉
