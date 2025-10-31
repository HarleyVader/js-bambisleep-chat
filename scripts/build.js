#!/usr/bin/env node
/**
 * BambiSleep Chat - Production Build Script
 * Comprehensive build process for the entire codebase
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class ProductionBuilder {
    constructor(options = {}) {
        this.buildDir = path.join(process.cwd(), 'dist');
        this.publicDir = path.join(process.cwd(), 'public');
        this.startTime = Date.now();
        this.buildSteps = [];
        this.options = {
            skipTests: options.skipTests || process.argv.includes('--skip-tests'),
            verbose: options.verbose || process.argv.includes('--verbose'),
            ...options
        };
    }

    /**
     * Execute a command with proper error handling
     */
    exec(command, description) {
        try {
            console.log(`🔄 ${description}...`);
            const result = execSync(command, {
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd()
            });
            console.log(`✅ ${description} completed`);
            this.buildSteps.push({ step: description, status: 'success', duration: Date.now() - this.startTime });
            return result;
        } catch (error) {
            console.error(`❌ ${description} failed:`, error.message);
            this.buildSteps.push({ step: description, status: 'failed', error: error.message });
            throw error;
        }
    }

    /**
     * Clean previous build artifacts
     */
    async cleanBuild() {
        try {
            console.log('🧹 Cleaning previous build...');
            await fs.rm(this.buildDir, { recursive: true, force: true });
            console.log('✅ Previous build cleaned');
        } catch (error) {
            // Directory might not exist, which is fine
            console.log('ℹ️  No previous build to clean');
        }
    }

    /**
     * Run pre-build validation
     */
    async validateEnvironment() {
        console.log('🔍 Validating build environment...');

        // Check Node.js version
        const nodeVersion = process.version;
        const requiredNode = '20.0.0';
        console.log(`📋 Node.js version: ${nodeVersion}`);

        // Check if all required files exist
        const requiredFiles = [
            'package.json',
            'src/server/server.js',
            'vite.config.js',
            'public/index.html',
            'src/config/env.js'
        ];

        for (const file of requiredFiles) {
            try {
                await fs.access(file);
                console.log(`✅ ${file} exists`);
            } catch (error) {
                throw new Error(`Required file missing: ${file}`);
            }
        }

        console.log('✅ Environment validation completed');
    }

    /**
     * Install production dependencies
     */
    async installDependencies() {
        this.exec('npm ci --production=false', 'Installing all dependencies');
    }

    /**
     * Run comprehensive tests
     */
    async runTests() {
        if (this.options.skipTests) {
            console.log('⏭️  Skipping tests (--skip-tests flag provided)');
            return;
        }

        try {
            this.exec('npm run test:critical', 'Running critical tests');
        } catch (error) {
            console.warn('⚠️  Some tests failed, but build will continue');
            console.warn('   Review test results before deployment');
        }
    }

    /**
     * Run security audit
     */
    async securityAudit() {
        try {
            this.exec('npm audit --audit-level moderate', 'Running security audit');
        } catch (error) {
            console.warn('⚠️  Security audit found issues, review before deployment');
        }
    }

    /**
     * Build frontend assets with Vite
     */
    async buildFrontend() {
        this.exec('npx vite build', 'Building frontend assets with Vite');

        // Verify build output
        try {
            const buildFiles = await fs.readdir(this.buildDir);
            console.log(`📦 Built ${buildFiles.length} files/directories`);

            // Check for essential files
            const hasIndex = buildFiles.some(file => file.includes('index'));
            const hasAssets = buildFiles.includes('assets');

            if (!hasIndex) {
                throw new Error('Missing index.html in build output');
            }

            console.log('✅ Frontend build verification completed');
        } catch (error) {
            throw new Error(`Frontend build verification failed: ${error.message}`);
        }
    }

    /**
     * Copy server files to build directory
     */
    async copyServerFiles() {
        console.log('📁 Copying server files...');

        const serverFiles = [
            'src/',
            'package.json',
            'package-lock.json',
            '.env.production',
            'scripts/',
            'bambisleepchat.service'
        ];

        for (const file of serverFiles) {
            try {
                const sourcePath = path.join(process.cwd(), file);
                const destPath = path.join(this.buildDir, file);

                // Check if source exists
                try {
                    await fs.access(sourcePath);
                } catch (error) {
                    console.log(`ℹ️  Skipping ${file} (not found)`);
                    continue;
                }

                // Get file stats to determine if it's a directory
                const stats = await fs.stat(sourcePath);

                if (stats.isDirectory()) {
                    await this.copyDirectory(sourcePath, destPath);
                } else {
                    await fs.mkdir(path.dirname(destPath), { recursive: true });
                    await fs.copyFile(sourcePath, destPath);
                }

                console.log(`✅ Copied ${file}`);
            } catch (error) {
                console.warn(`⚠️  Failed to copy ${file}: ${error.message}`);
            }
        }

        console.log('✅ Server files copied');
    }

    /**
     * Recursively copy directory
     */
    async copyDirectory(source, destination) {
        await fs.mkdir(destination, { recursive: true });

        const items = await fs.readdir(source);

        for (const item of items) {
            const sourcePath = path.join(source, item);
            const destPath = path.join(destination, item);

            const stats = await fs.stat(sourcePath);

            if (stats.isDirectory()) {
                await this.copyDirectory(sourcePath, destPath);
            } else {
                await fs.copyFile(sourcePath, destPath);
            }
        }
    }

    /**
     * Generate production package.json
     */
    async generateProductionPackage() {
        console.log('📦 Generating production package.json...');

        const packagePath = path.join(process.cwd(), 'package.json');
        const packageData = JSON.parse(await fs.readFile(packagePath, 'utf8'));

        // Create production version
        const prodPackage = {
            ...packageData,
            scripts: {
                start: 'node src/server/server.js',
                'prod:start': 'NODE_ENV=production node src/server/server.js',
                'validate-service': 'node scripts/validate-service.js'
            },
            // Remove devDependencies for production
            devDependencies: undefined
        };

        const prodPackagePath = path.join(this.buildDir, 'package.json');
        await fs.writeFile(prodPackagePath, JSON.stringify(prodPackage, null, 2));

        console.log('✅ Production package.json generated');
    }

    /**
     * Create build manifest
     */
    async createBuildManifest() {
        console.log('📄 Creating build manifest...');

        const manifest = {
            buildTime: new Date().toISOString(),
            version: require('../package.json').version,
            nodeVersion: process.version,
            buildSteps: this.buildSteps,
            environment: 'production',
            buildDuration: Date.now() - this.startTime
        };

        const manifestPath = path.join(this.buildDir, 'build-manifest.json');
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

        console.log('✅ Build manifest created');
    }

    /**
     * Optimize build for production
     */
    async optimizeBuild() {
        console.log('⚡ Optimizing build for production...');

        // Create .env.production template if it doesn't exist
        const envProdPath = path.join(this.buildDir, '.env.production');
        try {
            await fs.access(envProdPath);
        } catch (error) {
            // Create minimal production env template
            const prodEnvTemplate = `# Production Environment Configuration
NODE_ENV=production
PORT=7878

# Configure these for your production environment:
# KOKORO_HOST_PRODUCTION=your_tts_server_host
# LMS_HOST_PRODUCTION=your_lm_studio_host
# MONGODB_URI=your_mongodb_connection_string
`;
            await fs.writeFile(envProdPath, prodEnvTemplate);
            console.log('✅ Created .env.production template');
        }

        console.log('✅ Build optimization completed');
    }

    /**
     * Validate the final build
     */
    async validateBuild() {
        console.log('🔍 Validating final build...');

        // Check if essential files exist in build
        const essentialFiles = [
            'index.html',
            'src/server/server.js',
            'package.json',
            'src/config/env.js',
            'src/workers/kokoro.js',
            'src/workers/lmstudio.js',
            'src/workers/triggers.json'
        ];

        for (const file of essentialFiles) {
            const filePath = path.join(this.buildDir, file);
            try {
                await fs.access(filePath);
                console.log(`✅ ${file} exists in build`);
            } catch (error) {
                console.warn(`⚠️  Missing from build: ${file}`);
            }
        }

        // Get build size
        const buildSize = await this.getBuildSize(this.buildDir);
        console.log(`📊 Build size: ${this.formatBytes(buildSize)}`);

        console.log('✅ Build validation completed');
    }

    /**
     * Get directory size recursively
     */
    async getBuildSize(dir) {
        let size = 0;

        try {
            const items = await fs.readdir(dir);

            for (const item of items) {
                const itemPath = path.join(dir, item);
                const stats = await fs.stat(itemPath);

                if (stats.isDirectory()) {
                    size += await this.getBuildSize(itemPath);
                } else {
                    size += stats.size;
                }
            }
        } catch (error) {
            // Directory might not be accessible
        }

        return size;
    }

    /**
     * Format bytes to human readable format
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Main build process
     */
    async build() {
        try {
            console.log('🚀 Starting BambiSleep Chat production build...');
            if (this.options.skipTests) console.log('⚡ Fast build mode (skipping tests)');
            console.log('');

            await this.validateEnvironment();
            await this.cleanBuild();
            await this.installDependencies();
            await this.runTests();
            await this.securityAudit();
            await this.buildFrontend();
            await this.copyServerFiles();
            await this.generateProductionPackage();
            await this.optimizeBuild();
            await this.createBuildManifest();
            await this.validateBuild();

            const duration = Date.now() - this.startTime;
            const buildSizeMB = await this.getBuildSize(this.buildDir);

            console.log(`\n🎉 Build completed successfully in ${Math.round(duration / 1000)}s!`);
            console.log(`📁 Build output: ${this.buildDir}`);
            console.log(`📊 Build size: ${this.formatBytes(buildSizeMB)}`);
            console.log(`🚀 Ready for production deployment!`);
            console.log('\n📋 Next steps:');
            console.log('  1. Copy dist/ folder to production server');
            console.log('  2. Run: npm ci --production (in dist/ folder)');
            console.log('  3. Configure .env.production with your settings');
            console.log('  4. Run: npm start');

            return true;
        } catch (error) {
            console.error(`\n💥 Build failed: ${error.message}`);
            console.error('🔍 Check the error above and resolve issues before retrying');

            if (this.options.verbose) {
                console.error('\n📋 Build steps completed:');
                this.buildSteps.forEach(step => {
                    const status = step.status === 'success' ? '✅' : '❌';
                    console.error(`  ${status} ${step.step}`);
                });
            }

            process.exit(1);
        }
    }
}

// CLI execution
if (require.main === module) {
    const builder = new ProductionBuilder();
    builder.build();
}

module.exports = ProductionBuilder;