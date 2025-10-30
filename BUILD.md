# 🚀 BambiSleep Chat - Build System

## Overview

The BambiSleep Chat build system creates production-ready deployments with comprehensive validation, testing, and optimization.

## Build Commands

```bash
# Full production build (recommended)
npm run build

# Fast build (skips tests - for development)
npm run build:fast

# Verbose build (detailed output)
npm run build:verbose

# Clean build (removes previous artifacts first)
npm run build:clean
```

## Build Process

### 1. Environment Validation ✅
- Validates Node.js version (>=20.0.0)
- Checks for required files (server.js, package.json, etc.)
- Verifies project structure

### 2. Dependency Management 📦
- Installs all dependencies with `npm ci`
- Ensures clean dependency state

### 3. Quality Assurance 🧪
- Runs critical test suite
- Performs security audit
- Validates code integrity

### 4. Frontend Build ⚡
- Uses Vite to build optimized frontend assets
- Bundles JavaScript, CSS, and static assets
- Generates production-ready HTML

### 5. Server Packaging 📁
- Copies server files (server.js, config/, workers/)
- Generates production package.json
- Includes service files and scripts

### 6. Production Optimization 🎯
- Creates production environment template
- Optimizes file structure
- Removes development dependencies

### 7. Build Validation 🔍
- Verifies all essential files are present
- Calculates build size
- Creates build manifest with metadata

## Build Output

The build creates a `dist/` folder with:

```
dist/
├── index.html              # Frontend entry point
├── assets/                 # Bundled CSS/JS assets
├── server.js              # Main server file
├── package.json           # Production dependencies only
├── .env.production        # Production environment template
├── config/                # Server configuration
├── workers/               # Background workers (TTS, AI)
├── scripts/               # Deployment scripts
├── bambisleepchat.service # SystemD service file
└── build-manifest.json    # Build metadata and verification
```

## Build Manifest

Each build generates a manifest with:
- Build timestamp and version
- Node.js version used
- Build steps and their status
- Build duration and performance metrics
- Environment configuration

## Deployment

After building, deploy to production:

```bash
# 1. Copy dist/ folder to production server
scp -r dist/ user@server:/path/to/app/

# 2. Install production dependencies
cd /path/to/app/dist/
npm ci --production

# 3. Configure environment
cp .env.production .env
# Edit .env with your production settings

# 4. Start the application
npm start

# 5. (Optional) Set up as system service
sudo cp bambisleepchat.service /etc/systemd/system/
sudo systemctl enable bambisleepchat
sudo systemctl start bambisleepchat
```

## Build Features

### 🚀 **Fast Builds**
- Skip tests for rapid iteration: `npm run build:fast`
- Intelligent caching and optimization

### 🔍 **Comprehensive Validation**
- Environment compatibility checks
- File integrity verification
- Security auditing

### 📊 **Build Analytics**
- Detailed build step tracking
- Performance metrics
- Size analysis and reporting

### 🎯 **Production Ready**
- Optimized assets and bundles
- Clean production dependencies
- Service configuration included

### ⚡ **Developer Friendly**
- Detailed progress reporting
- Error handling with helpful messages
- Verbose mode for debugging

## Troubleshooting

### Common Issues

**Build fails with "Missing required file"**
- Ensure you're in the project root directory
- Check that all source files exist

**Tests fail during build**
- Run `npm run test` separately to identify issues
- Use `npm run build:fast` to skip tests temporarily

**Security audit warnings**
- Review security issues with `npm audit`
- Update dependencies or add exceptions as needed

**Build size too large**
- Check for unnecessary files being copied
- Review Vite build configuration for optimization

### Getting Help

1. Run build with verbose output: `npm run build:verbose`
2. Check the build manifest: `dist/build-manifest.json`
3. Review test reports: `tests/reports/`
4. Check system requirements: Node.js >=20.0.0

## Performance

Typical build times:
- **Fast build**: 5-10 seconds
- **Full build**: 10-15 seconds
- **Clean build**: 15-20 seconds

Build size: ~800KB (optimized production bundle)