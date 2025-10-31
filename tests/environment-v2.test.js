/**
 * Modern Environment Test Suite
 * Validates system environment, dependencies, and configuration
 * Compatible with Unified Test Framework v2.0
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const net = require('net');

class EnvironmentTestSuite {
    constructor() {
        this.name = 'Environment Validation';
        this.description = 'Validates Node.js environment, system resources, dependencies, and configuration';
        this.tags = ['environment', 'setup', 'dependencies', 'critical'];
        this.priority = 100; // Highest priority - run first
    }

    async run() {
        const results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            skipped: 0,
            tests: []
        };

        const tests = [
            { name: 'Node.js Version', test: () => this.testNodeVersion() },
            { name: 'System Memory', test: () => this.testSystemMemory() },
            { name: 'CPU Cores', test: () => this.testCPUCores() },
            { name: 'File System Access', test: () => this.testFileSystemAccess() },
            { name: 'Environment Variables', test: () => this.testEnvironmentVariables() },
            { name: 'Port Availability', test: () => this.testPortAvailability() },
            { name: 'NPM Dependencies', test: () => this.testDependencies() },
            { name: 'Configuration Files', test: () => this.testConfigurationFiles() },
            { name: 'Directory Structure', test: () => this.testDirectoryStructure() },
            { name: 'File Permissions', test: () => this.testFilePermissions() }
        ];

        for (const testDef of tests) {
            const testResult = {
                name: testDef.name,
                status: 'running',
                startTime: Date.now(),
                endTime: null,
                duration: 0,
                message: '',
                details: {}
            };

            try {
                const result = await testDef.test();
                testResult.status = result.passed ? 'passed' : (result.warning ? 'warning' : 'failed');
                testResult.message = result.message;
                testResult.details = result.details || {};

                if (testResult.status === 'passed') results.passed++;
                else if (testResult.status === 'failed') results.failed++;
                else if (testResult.status === 'warning') results.warnings++;

            } catch (error) {
                testResult.status = 'failed';
                testResult.message = `Test execution failed: ${error.message}`;
                testResult.details = { error: error.stack };
                results.failed++;
            }

            testResult.endTime = Date.now();
            testResult.duration = testResult.endTime - testResult.startTime;
            results.tests.push(testResult);

            this.logTestResult(testResult);
        }

        return results;
    }

    async testNodeVersion() {
        const currentVersion = process.version;
        const requiredVersion = '18.0.0';

        const current = this.parseVersion(currentVersion.slice(1)); // Remove 'v'
        const required = this.parseVersion(requiredVersion);

        const isValid = current.major > required.major ||
            (current.major === required.major && current.minor >= required.minor);

        return {
            passed: isValid,
            message: isValid
                ? `Node.js ${currentVersion} meets requirement (>=${requiredVersion})`
                : `Node.js ${currentVersion} does not meet requirement (>=${requiredVersion})`,
            details: {
                current: currentVersion,
                required: `>=${requiredVersion}`,
                valid: isValid
            }
        };
    }

    async testSystemMemory() {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const usagePercent = (usedMemory / totalMemory) * 100;

        const totalGB = (totalMemory / 1024 / 1024 / 1024).toFixed(2);
        const freeGB = (freeMemory / 1024 / 1024 / 1024).toFixed(2);

        const sufficientMemory = freeMemory > 1024 * 1024 * 1024; // At least 1GB free
        const warning = usagePercent > 90;

        return {
            passed: sufficientMemory,
            warning: warning && sufficientMemory,
            message: sufficientMemory
                ? `Memory OK: ${freeGB}GB free of ${totalGB}GB total`
                : `Insufficient memory: Only ${freeGB}GB free of ${totalGB}GB total`,
            details: {
                totalMemory: parseInt(totalGB),
                freeMemory: parseFloat(freeGB),
                usagePercent: parseFloat(usagePercent.toFixed(1)),
                sufficient: sufficientMemory
            }
        };
    }

    async testCPUCores() {
        const cpuCores = os.cpus().length;
        const sufficient = cpuCores >= 2;

        return {
            passed: sufficient,
            message: sufficient
                ? `CPU OK: ${cpuCores} core(s) available`
                : `Limited CPU: Only ${cpuCores} core(s) available (recommended: 2+)`,
            details: {
                cores: cpuCores,
                sufficient: sufficient,
                recommended: 2
            }
        };
    }

    async testFileSystemAccess() {
        const testPaths = [
            'public/js/aigf-core.js',
            'src/server/server.js',
            'src/workers/kokoro.js',
            'src/workers/lmstudio.js',
            'src/workers/triggers.json',
            'public/css/layers.css',
            'src/config/env.js'
        ];

        const results = [];
        let allExist = true;

        for (const filePath of testPaths) {
            try {
                await fs.access(filePath);
                results.push({ path: filePath, exists: true });
            } catch {
                results.push({ path: filePath, exists: false });
                allExist = false;
            }
        }

        // Test write permissions
        let writeAccess = true;
        try {
            const testFile = 'tests/.write-test-temp';
            await fs.writeFile(testFile, 'test');
            await fs.unlink(testFile);
        } catch {
            writeAccess = false;
            allExist = false;
        }

        return {
            passed: allExist && writeAccess,
            message: allExist && writeAccess
                ? 'File system access OK'
                : 'File system access issues detected',
            details: {
                fileTests: results,
                writeAccess: writeAccess,
                missingFiles: results.filter(r => !r.exists).map(r => r.path)
            }
        };
    }

    async testEnvironmentVariables() {
        try {
            // Try to load environment configuration
            const envPath = path.join(process.cwd(), 'src', 'config', 'env.js');
            const configExists = await fs.access(envPath).then(() => true).catch(() => false);

            if (!configExists) {
                return {
                    passed: false,
                    message: 'Environment configuration not found',
                    details: { configPath: envPath, exists: false }
                };
            }

            // Test .env file
            const dotEnvPath = path.join(process.cwd(), '.env');
            const dotEnvExists = await fs.access(dotEnvPath).then(() => true).catch(() => false);

            const requiredVars = [
                'NODE_ENV',
                'PORT',
                'KOKORO_HOST_DEVELOPMENT',
                'KOKORO_HOST_PRODUCTION',
                'LMS_HOST_DEVELOPMENT',
                'LMS_HOST_PRODUCTION',
                'KOKORO_PORT',
                'LMS_PORT'
            ];

            const missingVars = [];
            const presentVars = [];

            // Load environment variables
            require('dotenv').config();

            for (const varName of requiredVars) {
                if (process.env[varName]) {
                    presentVars.push(varName);
                } else {
                    missingVars.push(varName);
                }
            }

            const allPresent = missingVars.length === 0;

            return {
                passed: allPresent && dotEnvExists,
                warning: !dotEnvExists && allPresent,
                message: allPresent
                    ? `Environment variables configured (${presentVars.length}/${requiredVars.length})`
                    : `Missing environment variables: ${missingVars.join(', ')}`,
                details: {
                    dotEnvExists,
                    requiredVars,
                    presentVars,
                    missingVars,
                    configFileExists: configExists
                }
            };
        } catch (error) {
            return {
                passed: false,
                message: `Environment test failed: ${error.message}`,
                details: { error: error.message }
            };
        }
    }

    async testPortAvailability() {
        const ports = [
            { port: 5173, name: 'Vite Dev Server' },
            { port: 7878, name: 'Backend Server' },
            { port: 8880, name: 'Kokoro TTS' },
            { port: 7777, name: 'LM Studio' }
        ];

        const results = [];
        let allAvailable = true;

        for (const portInfo of ports) {
            const available = await this.isPortAvailable(portInfo.port);
            results.push({
                port: portInfo.port,
                name: portInfo.name,
                available
            });

            if (!available) {
                allAvailable = false;
            }
        }

        return {
            passed: allAvailable,
            message: allAvailable
                ? 'All required ports available'
                : `Some ports unavailable: ${results.filter(r => !r.available).map(r => r.port).join(', ')}`,
            details: {
                portTests: results,
                unavailablePorts: results.filter(r => !r.available)
            }
        };
    }

    async testDependencies() {
        const requiredDeps = [
            'express',
            'socket.io',
            '@lmstudio/sdk',
            'dotenv',
            'axios'
        ];

        const results = [];
        let allInstalled = true;

        for (const dep of requiredDeps) {
            try {
                // Try to require the package itself first
                require.resolve(dep);

                // Try to get version from package.json
                let version = null;
                try {
                    version = require(`${dep}/package.json`).version;
                } catch {
                    // If package.json not accessible, try alternative location
                    try {
                        version = require(`node_modules/${dep}/package.json`).version;
                    } catch {
                        // Just mark as installed with unknown version
                        version = 'installed';
                    }
                }

                results.push({ package: dep, installed: true, version });
            } catch {
                results.push({ package: dep, installed: false, version: null });
                allInstalled = false;
            }
        }

        return {
            passed: allInstalled,
            message: allInstalled
                ? `All dependencies installed (${results.length})`
                : `Missing dependencies: ${results.filter(r => !r.installed).map(r => r.package).join(', ')}`,
            details: {
                dependencies: results,
                missing: results.filter(r => !r.installed).map(r => r.package)
            }
        };
    }

    async testConfigurationFiles() {
        const configFiles = [
            { path: 'package.json', required: true },
            { path: 'vite.config.js', required: true },
            { path: 'src/config/env.js', required: true },
            { path: '.env', required: false },
            { path: '.gitignore', required: false }
        ];

        const results = [];
        let allRequired = true;

        for (const config of configFiles) {
            try {
                await fs.access(config.path);
                results.push({ path: config.path, exists: true, required: config.required });
            } catch {
                results.push({ path: config.path, exists: false, required: config.required });
                if (config.required) {
                    allRequired = false;
                }
            }
        }

        return {
            passed: allRequired,
            message: allRequired
                ? 'All configuration files present'
                : `Missing required config: ${results.filter(r => r.required && !r.exists).map(r => r.path).join(', ')}`,
            details: {
                configFiles: results,
                missing: results.filter(r => !r.exists),
                missingRequired: results.filter(r => r.required && !r.exists)
            }
        };
    }

    async testDirectoryStructure() {
        const requiredDirs = [
            'public',
            'public/js',
            'public/css',
            'public/js/dropdowns',
            'src/workers',
            'src/config',
            'tests',
            'tests/reports'
        ];

        const results = [];
        let allExist = true;

        for (const dir of requiredDirs) {
            try {
                const stats = await fs.stat(dir);
                results.push({
                    path: dir,
                    exists: true,
                    isDirectory: stats.isDirectory()
                });

                if (!stats.isDirectory()) {
                    allExist = false;
                }
            } catch {
                results.push({
                    path: dir,
                    exists: false,
                    isDirectory: false
                });
                allExist = false;
            }
        }

        return {
            passed: allExist,
            message: allExist
                ? 'Directory structure complete'
                : `Missing directories: ${results.filter(r => !r.exists).map(r => r.path).join(', ')}`,
            details: {
                directories: results,
                missing: results.filter(r => !r.exists || !r.isDirectory)
            }
        };
    }

    async testFilePermissions() {
        const testFiles = [
            { path: 'src/server/server.js', needsRead: true, needsWrite: false },
            { path: 'package.json', needsRead: true, needsWrite: false },
            { path: 'tests', needsRead: true, needsWrite: true },
            { path: 'tests/reports', needsRead: true, needsWrite: true }
        ];

        const results = [];
        let allCorrect = true;

        for (const file of testFiles) {
            try {
                // First check if file/directory exists
                const stats = await fs.stat(file.path);
                
                // Test read access
                await fs.access(file.path, fs.constants.R_OK);
                let readAccess = true;

                // Test write access if needed
                let writeAccess = true;
                if (file.needsWrite) {
                    try {
                        await fs.access(file.path, fs.constants.W_OK);
                    } catch (error) {
                        writeAccess = false;
                        allCorrect = false;
                    }
                }

                results.push({
                    path: file.path,
                    exists: true,
                    readAccess,
                    writeAccess,
                    needsWrite: file.needsWrite,
                    isDirectory: stats.isDirectory()
                });

            } catch (error) {
                results.push({
                    path: file.path,
                    exists: false,
                    readAccess: false,
                    writeAccess: false,
                    needsWrite: file.needsWrite,
                    isDirectory: false,
                    error: error.code || error.message
                });
                allCorrect = false;
            }
        }

        return {
            passed: allCorrect,
            message: allCorrect
                ? 'File permissions correct'
                : 'File permission issues detected',
            details: {
                permissions: results,
                issues: results.filter(r => !r.readAccess || (r.needsWrite && !r.writeAccess))
            }
        };
    }

    // Helper methods
    parseVersion(version) {
        const [major, minor, patch] = version.split('.').map(Number);
        return { major, minor, patch };
    }

    async isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = net.createServer();

            server.listen(port, () => {
                server.once('close', () => resolve(true));
                server.close();
            });

            server.on('error', () => resolve(false));
        });
    }

    logTestResult(testResult) {
        const emoji = {
            'passed': '✅',
            'failed': '❌',
            'warning': '⚠️',
            'skipped': '⏭️'
        }[testResult.status];

        console.log(`${emoji} ${testResult.name}: ${testResult.message}`);
    }
}

// Export for both unified framework and legacy compatibility
const environmentTestSuite = new EnvironmentTestSuite();

module.exports = {
    // Unified framework compatible
    testSuite: environmentTestSuite,
    config: {
        name: 'environment',
        description: environmentTestSuite.description,
        tags: environmentTestSuite.tags,
        priority: environmentTestSuite.priority,
        timeout: 30000,
        enabled: true
    },

    // Legacy compatibility
    EnvironmentTester: environmentTestSuite,
    default: environmentTestSuite
};
