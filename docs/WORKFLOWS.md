# BambiSleep Chat - Unified Workflows

Comprehensive workflow commands that run everything in sequence for different scenarios.

## Quick Reference

```bash
# Complete production workflow (15-30 minutes)
npm run workflow

# Fast development workflow (2-5 minutes)  
npm run workflow:fast

# CI/CD pipeline workflow (20-40 minutes)
npm run workflow:ci

# Development startup workflow (1-2 minutes)
npm run workflow:dev
```

## Workflow Details

### 1. `npm run workflow` - Complete Production Workflow

**Purpose**: Full production-ready build with comprehensive validation

**Sequence**:
1. 🧹 **Clean**: `npm run clean` - Remove all build artifacts and caches
2. 📦 **Update Dependencies**: `npm run update-deps` - Update and audit fix dependencies  
3. 🧪 **Test Suite**: `npm run test` - Run complete unified test framework (32 tests)
4. 🔒 **Security Audit**: `npm run security` - Check for vulnerabilities (moderate+ level)
5. 🏗️ **Production Build**: `npm run build` - Complete Vite build with server packaging
6. ✅ **Production Validation**: `npm run prod:validate` - Final critical tests + production audit

**Duration**: ~15-30 minutes
**Use Case**: Pre-deployment, releases, comprehensive validation
**Exit Strategy**: Fails fast on any step error

### 2. `npm run workflow:fast` - Fast Development Workflow  

**Purpose**: Rapid iteration for active development

**Sequence**:
1. 🧹 **Light Clean**: `npm run clean:light` - Remove temp files only
2. 🧪 **Critical Tests**: `npm run test:critical` - Essential tests only (6-8 tests)
3. 🏗️ **Fast Build**: `npm run build:fast` - Skip tests, optimize for speed
4. ✅ **Success confirmation**

**Duration**: ~2-5 minutes
**Use Case**: Feature development, bug fixes, rapid testing
**Exit Strategy**: Continues on minor test failures

### 3. `npm run workflow:ci` - CI/CD Pipeline Workflow

**Purpose**: Automated continuous integration with clean environment

**Sequence**:
1. 🧹 **Complete Clean**: `npm run clean` - Remove all artifacts
2. 📦 **Clean Install**: `npm ci` - Fresh dependency installation (no package-lock changes)
3. 🧪 **CI Test Suite**: `npm run test:ci` - Tests with HTML reports and strict failure handling
4. 🔒 **Security Audit**: `npm run security` - Vulnerability scanning
5. 🏗️ **Production Build**: `npm run build` - Complete build process
6. ✅ **Production Validation**: `npm run prod:validate` - Final production checks

**Duration**: ~20-40 minutes  
**Use Case**: GitHub Actions, automated deployments, clean environments
**Exit Strategy**: Strict failure handling with detailed reports

### 4. `npm run workflow:dev` - Development Startup Workflow

**Purpose**: Prepare and start development environment

**Sequence**:
1. 🧹 **Light Clean**: `npm run clean:light` - Clear temporary files
2. 🧪 **Critical Tests**: `npm run test:critical` - Ensure basic functionality
3. 🚀 **Start Development**: `npm run dev` - Launch concurrent Vite (5173) + Express (7878)

**Duration**: ~1-2 minutes
**Use Case**: Daily development startup, environment preparation  
**Exit Strategy**: Launches dev servers on success

## Workflow Architecture

### Error Handling Strategy
- **Fail Fast**: All workflows exit immediately on critical errors
- **Chain Commands**: Uses `&&` to ensure sequential execution
- **Status Reporting**: Clear success/failure messages with emojis
- **Exit Codes**: Proper exit codes for CI/CD integration

### Performance Optimization
- **Parallel Execution**: Where safe (test categories, build steps)
- **Incremental Builds**: Fast workflows skip unnecessary steps
- **Dependency Caching**: Respects npm ci vs npm install patterns
- **Resource Management**: Memory and CPU optimized for concurrent operations

### Environment Integration
```bash
# Environment-aware workflows
NODE_ENV=production npm run workflow     # Production optimizations
NODE_ENV=development npm run workflow:dev # Development features
TEST_VERBOSE=true npm run workflow:ci     # Detailed test output
```

### Custom Workflow Examples

```bash
# Quick validation before commit
npm run workflow:fast && git add . && git commit -m "feature: description"

# Full release preparation  
npm run workflow && npm run deploy:status

# Emergency hotfix workflow
npm run clean:light && npm run test:critical && npm run build:fast && npm run deploy:update

# Integration testing
npm run mcp:status && npm run workflow:ci
```

## Monitoring & Debugging

### Success Indicators
- ✅ Green checkmarks for completed steps
- 📊 Test success rates (target: 96%+)
- 🔒 Zero security vulnerabilities  
- 📦 Build size reports (~800KB target)
- ⏱️ Performance benchmarks

### Failure Debugging
```bash
# Verbose output for troubleshooting
cross-env TEST_VERBOSE=true npm run workflow

# Individual step debugging
npm run test:verbose        # Detailed test output
npm run build:verbose       # Verbose build information
npm run security            # Detailed vulnerability report
```

### Log Locations
- `tests/reports/` - Test execution reports (HTML + JSON)
- `dist/build-manifest.json` - Build metadata and timings
- Terminal output - Real-time step progress

## Integration with Existing Commands

These workflows complement the existing script ecosystem:

```bash
# Production deployment chain
npm run workflow && npm run deploy:install

# Development debugging chain  
npm run workflow:fast && npm run test:dropdowns

# Performance analysis chain
npm run workflow && npm run test:performance

# MCP server validation chain
npm run mcp:status && npm run workflow:dev
```

## Best Practices

1. **Daily Development**: Use `npm run workflow:fast` for regular work
2. **Pre-Commit**: Use `npm run workflow:fast` before git commits  
3. **Pre-Deployment**: Use `npm run workflow` before production releases
4. **CI/CD**: Use `npm run workflow:ci` in automated pipelines
5. **Environment Setup**: Use `npm run workflow:dev` for new development sessions

## Troubleshooting

### Common Issues
- **Node Version**: Ensure Node.js 20+ (check with `node --version`)
- **Memory**: Large workflows may need `--max-old-space-size=4096`
- **Permissions**: Windows may require administrator for global installs
- **Network**: MCP servers require internet connectivity

### Recovery Commands
```bash
# Reset everything
npm run clean:full && npm install && npm run workflow:fast

# Emergency build
npm run clean && npm ci && npm run build:fast

# Skip failing tests temporarily  
npm run clean:light && npm run build:fast
```

---

*BambiSleep Chat v0.3.0 - Enterprise-grade chat application with comprehensive workflow automation*