/**
 * BambiSleep Chat - Unified Testing Framework
 * Centralized, modular, and future-proof test system
 *
 * Features:
 * - Modular test suite architecture
 * - Parallel test execution
 * - Comprehensive reporting
 * - CI/CD integration ready
 * - Extensible plugin system
 * - Real-time progress tracking
 * - Automated performance benchmarking
 */

const fs = require('fs').promises;
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

/**
 * Unified Test Framework Core
 * Manages test execution, reporting, and lifecycle
 */
class UnifiedTestFramework {
    constructor(options = {}) {
        this.version = '2.0.0';
        this.config = {
            parallel: options.parallel !== false, // Default to parallel execution
            timeout: options.timeout || 300000, // 5 minutes default timeout
            retries: options.retries || 0,
            verbose: options.verbose || false,
            generateReports: options.generateReports !== false,
            exitOnFailure: options.exitOnFailure !== false,
            ...options
        };

        this.testSuites = new Map();
        this.results = {
            framework: {
                version: this.version,
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                startTime: new Date().toISOString(),
                endTime: null,
                duration: 0,
                config: this.config
            },
            summary: {
                totalSuites: 0,
                passedSuites: 0,
                failedSuites: 0,
                skippedSuites: 0,
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                warningTests: 0,
                skippedTests: 0
            },
            suites: [],
            performance: {
                memoryUsage: [],
                cpuUsage: [],
                testTiming: {}
            }
        };

        this.hooks = {
            beforeAll: [],
            afterAll: [],
            beforeEach: [],
            afterEach: []
        };

        this.reporters = [];
        this.startTime = Date.now();
        this.reportDir = path.join(process.cwd(), 'tests', 'reports');

        // Initialize performance monitoring
        this.performanceMonitor = new PerformanceMonitor();
    }

    /**
     * Register a test suite
     */
    registerSuite(name, testSuite, options = {}) {
        if (this.testSuites.has(name)) {
            throw new Error(`Test suite '${name}' is already registered`);
        }

        const suiteConfig = {
            name,
            testSuite,
            enabled: options.enabled !== false,
            timeout: options.timeout || this.config.timeout,
            retries: options.retries || this.config.retries,
            parallel: options.parallel !== false,
            priority: options.priority || 0,
            tags: options.tags || [],
            dependencies: options.dependencies || [],
            description: options.description || '',
            ...options
        };

        this.testSuites.set(name, suiteConfig);
        this.log(`📝 Registered test suite: ${name}`, 'info');
        return this;
    }

    /**
     * Register multiple test suites from directory
     */
    async registerSuitesFromDirectory(directory, pattern = /\\.test\\.js$/) {
        const files = await fs.readdir(directory);

        for (const file of files) {
            if (pattern.test(file)) {
                const suitePath = path.join(directory, file);
                try {
                    const suite = require(suitePath);
                    const suiteName = path.basename(file, '.test.js');

                    if (suite.default) {
                        this.registerSuite(suiteName, suite.default, suite.config || {});
                    } else if (typeof suite === 'function') {
                        this.registerSuite(suiteName, suite);
                    } else if (suite.testSuite) {
                        this.registerSuite(suiteName, suite.testSuite, suite.config || {});
                    }
                } catch (error) {
                    this.log(`❌ Failed to load test suite ${file}: ${error.message}`, 'error');
                }
            }
        }

        return this;
    }

    /**
     * Add lifecycle hooks
     */
    beforeAll(callback) {
        this.hooks.beforeAll.push(callback);
        return this;
    }

    afterAll(callback) {
        this.hooks.afterAll.push(callback);
        return this;
    }

    beforeEach(callback) {
        this.hooks.beforeEach.push(callback);
        return this;
    }

    afterEach(callback) {
        this.hooks.afterEach.push(callback);
        return this;
    }

    /**
     * Add custom reporters
     */
    addReporter(reporter) {
        this.reporters.push(reporter);
        return this;
    }

    /**
     * Run all registered test suites
     */
    async run(filterTags = []) {
        this.log('🚀 === UNIFIED TEST FRAMEWORK v2.0 ===', 'header');
        this.log(`📊 Framework Configuration:`, 'info');
        this.log(`   • Parallel Execution: ${this.config.parallel ? 'Enabled' : 'Disabled'}`, 'info');
        this.log(`   • Timeout: ${this.config.timeout / 1000}s`, 'info');
        this.log(`   • Retries: ${this.config.retries}`, 'info');
        this.log(`   • Report Generation: ${this.config.generateReports ? 'Enabled' : 'Disabled'}`, 'info');
        this.log('', 'info');

        try {
            // Start performance monitoring
            this.performanceMonitor.start();

            // Run beforeAll hooks
            await this.runHooks('beforeAll');

            // Filter suites by tags if specified
            const suitesToRun = this.filterSuitesByTags(filterTags);

            // Sort suites by priority and dependencies
            const orderedSuites = this.orderSuites(suitesToRun);

            this.log(`🎯 Running ${orderedSuites.length} test suite(s)`, 'info');

            // Execute suites
            if (this.config.parallel) {
                await this.runSuitesParallel(orderedSuites);
            } else {
                await this.runSuitesSequential(orderedSuites);
            }

            // Run afterAll hooks
            await this.runHooks('afterAll');

            // Stop performance monitoring
            this.performanceMonitor.stop();

            // Finalize results
            this.finalizeResults();

            // Generate reports
            if (this.config.generateReports) {
                await this.generateReports();
            }

            // Print summary
            this.printSummary();

            // Exit with appropriate code
            const exitCode = this.results.summary.failedTests > 0 ? 1 : 0;
            if (this.config.exitOnFailure && exitCode !== 0) {
                process.exit(exitCode);
            }

            return this.results;

        } catch (error) {
            this.log(`💥 Fatal error in test framework: ${error.message}`, 'error');
            if (this.config.verbose) {
                console.error(error.stack);
            }

            if (this.config.exitOnFailure) {
                process.exit(1);
            }
            throw error;
        }
    }

    /**
     * Filter test suites by tags
     */
    filterSuitesByTags(filterTags) {
        if (filterTags.length === 0) {
            return Array.from(this.testSuites.values()).filter(suite => suite.enabled);
        }

        return Array.from(this.testSuites.values()).filter(suite => {
            if (!suite.enabled) return false;
            return filterTags.some(tag => suite.tags.includes(tag));
        });
    }

    /**
     * Order suites by dependencies and priority
     */
    orderSuites(suites) {
        // Simple topological sort for dependencies
        const ordered = [];
        const visited = new Set();
        const visiting = new Set();

        const visit = (suite) => {
            if (visiting.has(suite.name)) {
                throw new Error(`Circular dependency detected involving suite: ${suite.name}`);
            }
            if (visited.has(suite.name)) {
                return;
            }

            visiting.add(suite.name);

            // Visit dependencies first
            for (const depName of suite.dependencies) {
                const depSuite = suites.find(s => s.name === depName);
                if (depSuite) {
                    visit(depSuite);
                }
            }

            visiting.delete(suite.name);
            visited.add(suite.name);
            ordered.push(suite);
        };

        // Sort by priority first, then resolve dependencies
        const prioritySorted = suites.sort((a, b) => b.priority - a.priority);

        for (const suite of prioritySorted) {
            if (!visited.has(suite.name)) {
                visit(suite);
            }
        }

        return ordered;
    }

    /**
     * Run test suites in parallel
     */
    async runSuitesParallel(suites) {
        this.log('🔄 Running test suites in parallel...', 'info');

        const promises = suites.map(async (suite) => {
            return this.runSingleSuite(suite);
        });

        const results = await Promise.allSettled(promises);

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                this.log(`❌ Suite '${suites[index].name}' failed with error: ${result.reason.message}`, 'error');
            }
        });
    }

    /**
     * Run test suites sequentially
     */
    async runSuitesSequential(suites) {
        this.log('🔄 Running test suites sequentially...', 'info');

        for (const suite of suites) {
            await this.runSingleSuite(suite);
        }
    }

    /**
     * Run a single test suite
     */
    async runSingleSuite(suiteConfig) {
        const startTime = Date.now();
        const suiteName = suiteConfig.name;

        this.log(`📋 Running suite: ${suiteName}`, 'info');

        const suiteResult = {
            name: suiteName,
            description: suiteConfig.description,
            status: 'running',
            startTime: new Date().toISOString(),
            endTime: null,
            duration: 0,
            passed: 0,
            failed: 0,
            warnings: 0,
            skipped: 0,
            tests: [],
            error: null,
            metadata: {
                tags: suiteConfig.tags,
                priority: suiteConfig.priority,
                retries: suiteConfig.retries
            }
        };

        try {
            // Run beforeEach hooks
            await this.runHooks('beforeEach', { suite: suiteConfig });

            // Execute the test suite
            let testResults;

            if (typeof suiteConfig.testSuite === 'function') {
                // Direct function execution
                testResults = await this.executeWithTimeout(
                    suiteConfig.testSuite,
                    suiteConfig.timeout
                );
            } else if (suiteConfig.testSuite.run) {
                // Object with run method
                testResults = await this.executeWithTimeout(
                    () => suiteConfig.testSuite.run(),
                    suiteConfig.timeout
                );
            } else {
                throw new Error(`Invalid test suite format for ${suiteName}`);
            }

            // Process results
            if (testResults) {
                suiteResult.passed = testResults.passed || 0;
                suiteResult.failed = testResults.failed || 0;
                suiteResult.warnings = testResults.warnings || 0;
                suiteResult.skipped = testResults.skipped || 0;
                suiteResult.tests = testResults.tests || [];
            }

            suiteResult.status = suiteResult.failed > 0 ? 'failed' : 'passed';

            // Run afterEach hooks
            await this.runHooks('afterEach', { suite: suiteConfig, result: suiteResult });

        } catch (error) {
            suiteResult.status = 'failed';
            suiteResult.error = {
                message: error.message,
                stack: error.stack
            };
            suiteResult.failed = 1;

            this.log(`❌ Suite '${suiteName}' failed: ${error.message}`, 'error');

            if (this.config.verbose) {
                console.error(error.stack);
            }
        } finally {
            const endTime = Date.now();
            suiteResult.endTime = new Date().toISOString();
            suiteResult.duration = endTime - startTime;

            // Update framework results
            this.results.suites.push(suiteResult);
            this.updateSummary(suiteResult);

            this.log(`${suiteResult.status === 'passed' ? '✅' : '❌'} Suite '${suiteName}' completed in ${suiteResult.duration}ms`, 'info');
        }

        return suiteResult;
    }

    /**
     * Execute function with timeout
     */
    async executeWithTimeout(fn, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Test suite timed out after ${timeout}ms`));
            }, timeout);

            Promise.resolve(fn()).then((result) => {
                clearTimeout(timer);
                resolve(result);
            }).catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }

    /**
     * Run lifecycle hooks
     */
    async runHooks(hookName, context = {}) {
        const hooks = this.hooks[hookName];

        for (const hook of hooks) {
            try {
                await hook(context);
            } catch (error) {
                this.log(`❌ Hook '${hookName}' failed: ${error.message}`, 'error');
                if (this.config.verbose) {
                    console.error(error.stack);
                }
                throw error;
            }
        }
    }

    /**
     * Update summary statistics
     */
    updateSummary(suiteResult) {
        this.results.summary.totalSuites++;

        if (suiteResult.status === 'passed') {
            this.results.summary.passedSuites++;
        } else if (suiteResult.status === 'failed') {
            this.results.summary.failedSuites++;
        } else if (suiteResult.status === 'skipped') {
            this.results.summary.skippedSuites++;
        }

        this.results.summary.totalTests += suiteResult.passed + suiteResult.failed + suiteResult.warnings + suiteResult.skipped;
        this.results.summary.passedTests += suiteResult.passed;
        this.results.summary.failedTests += suiteResult.failed;
        this.results.summary.warningTests += suiteResult.warnings;
        this.results.summary.skippedTests += suiteResult.skipped;
    }

    /**
     * Finalize test results
     */
    finalizeResults() {
        const endTime = Date.now();
        this.results.framework.endTime = new Date().toISOString();
        this.results.framework.duration = endTime - this.startTime;
        this.results.performance = this.performanceMonitor.getResults();
    }

    /**
     * Generate comprehensive reports
     */
    async generateReports() {
        await this.ensureReportDirectory();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        // Generate JSON report
        const jsonReportPath = path.join(this.reportDir, `unified-test-report-${timestamp}.json`);
        await fs.writeFile(jsonReportPath, JSON.stringify(this.results, null, 2));

        // Generate HTML report
        const htmlReportPath = path.join(this.reportDir, `unified-test-report-${timestamp}.html`);
        await this.generateHtmlReport(htmlReportPath);

        // Generate summary
        const summaryPath = path.join(this.reportDir, 'latest-unified-summary.txt');
        await this.generateTextSummary(summaryPath);

        // Run custom reporters
        for (const reporter of this.reporters) {
            try {
                await reporter(this.results, this.reportDir);
            } catch (error) {
                this.log(`❌ Reporter failed: ${error.message}`, 'error');
            }
        }

        this.log(`📊 Reports generated:`, 'info');
        this.log(`   • JSON: ${jsonReportPath}`, 'info');
        this.log(`   • HTML: ${htmlReportPath}`, 'info');
        this.log(`   • Summary: ${summaryPath}`, 'info');
    }

    /**
     * Generate HTML report
     */
    async generateHtmlReport(filePath) {
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BambiSleep Chat - Unified Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .title { color: #007bff; margin: 0; font-size: 2.5em; }
        .subtitle { color: #666; margin: 10px 0 0 0; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-card.success { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
        .stat-card.danger { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
        .stat-card.warning { background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); color: #333; }
        .stat-value { font-size: 2.5em; font-weight: bold; margin: 0; }
        .stat-label { font-size: 0.9em; opacity: 0.9; margin: 5px 0 0 0; }
        .suite { margin: 30px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .suite-header { display: flex; align-items: center; margin-bottom: 15px; }
        .suite-status { width: 20px; height: 20px; border-radius: 50%; margin-right: 10px; }
        .suite-status.passed { background: #28a745; }
        .suite-status.failed { background: #dc3545; }
        .suite-status.skipped { background: #ffc107; }
        .suite-name { font-size: 1.3em; font-weight: bold; margin: 0; }
        .suite-duration { color: #666; margin-left: auto; }
        .performance { margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
        .performance h3 { margin-top: 0; color: #495057; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">🧠 BambiSleep Chat</h1>
            <h2 class="subtitle">Unified Test Framework Report v${this.version}</h2>
            <p><strong>Generated:</strong> ${this.results.framework.endTime}</p>
            <p><strong>Duration:</strong> ${(this.results.framework.duration / 1000).toFixed(2)}s</p>
            <p><strong>Node.js:</strong> ${this.results.framework.nodeVersion} | <strong>Platform:</strong> ${this.results.framework.platform}</p>
        </div>

        <div class="summary">
            <div class="stat-card ${this.results.summary.failedTests === 0 ? 'success' : 'danger'}">
                <div class="stat-value">${this.results.summary.totalTests}</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card success">
                <div class="stat-value">${this.results.summary.passedTests}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-card danger">
                <div class="stat-value">${this.results.summary.failedTests}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-value">${this.results.summary.warningTests}</div>
                <div class="stat-label">Warnings</div>
            </div>
        </div>

        <h3>📋 Test Suites</h3>
        ${this.results.suites.map(suite => `
            <div class="suite">
                <div class="suite-header">
                    <div class="suite-status ${suite.status}"></div>
                    <h4 class="suite-name">${suite.name}</h4>
                    <span class="suite-duration">${suite.duration}ms</span>
                </div>
                <p>${suite.description || 'No description provided'}</p>
                <p><strong>Results:</strong> ${suite.passed}✅ ${suite.failed}❌ ${suite.warnings}⚠️ ${suite.skipped}⏭️</p>
                ${suite.error ? `<p style="color: #dc3545;"><strong>Error:</strong> ${suite.error.message}</p>` : ''}
            </div>
        `).join('')}

        <div class="performance">
            <h3>📈 Performance Metrics</h3>
            <p><strong>Peak Memory Usage:</strong> ${Math.max(...this.results.performance.memoryUsage.map(m => m.heapUsed)).toLocaleString()} bytes</p>
            <p><strong>Average Memory:</strong> ${(this.results.performance.memoryUsage.reduce((a, b) => a + b.heapUsed, 0) / this.results.performance.memoryUsage.length).toLocaleString()} bytes</p>
        </div>
    </div>
</body>
</html>`;

        await fs.writeFile(filePath, html);
    }

    /**
     * Generate text summary
     */
    async generateTextSummary(filePath) {
        const summary = `
BambiSleep Chat - Unified Test Framework Report
===============================================

Generated: ${this.results.framework.endTime}
Duration: ${(this.results.framework.duration / 1000).toFixed(2)}s
Framework Version: ${this.version}
Node.js: ${this.results.framework.nodeVersion}
Platform: ${this.results.framework.platform}

SUMMARY
-------
Total Tests: ${this.results.summary.totalTests}
Passed: ${this.results.summary.passedTests} ✅
Failed: ${this.results.summary.failedTests} ❌
Warnings: ${this.results.summary.warningTests} ⚠️
Skipped: ${this.results.summary.skippedTests} ⏭️

Test Suites: ${this.results.summary.totalSuites}
Passed Suites: ${this.results.summary.passedSuites}
Failed Suites: ${this.results.summary.failedSuites}

SUCCESS RATE: ${((this.results.summary.passedTests / this.results.summary.totalTests) * 100).toFixed(1)}%

SUITE DETAILS
------------
${this.results.suites.map(suite => `
${suite.name}: ${suite.status.toUpperCase()}
  Duration: ${suite.duration}ms
  Results: ${suite.passed}✅ ${suite.failed}❌ ${suite.warnings}⚠️ ${suite.skipped}⏭️
  ${suite.error ? `Error: ${suite.error.message}` : ''}
`).join('')}

Overall Status: ${this.results.summary.failedTests === 0 ? 'SUCCESS ✅' : 'FAILURE ❌'}
`;

        await fs.writeFile(filePath, summary.trim());
    }

    /**
     * Print summary to console
     */
    printSummary() {
        this.log('', 'info');
        this.log('🏁 === TEST EXECUTION COMPLETE ===', 'header');
        this.log(`📊 Summary: ${this.results.summary.passedTests}✅ ${this.results.summary.failedTests}❌ ${this.results.summary.warningTests}⚠️ ${this.results.summary.skippedTests}⏭️`, 'info');
        this.log(`⏱️ Duration: ${(this.results.framework.duration / 1000).toFixed(2)}s`, 'info');
        this.log(`📈 Success Rate: ${((this.results.summary.passedTests / this.results.summary.totalTests) * 100).toFixed(1)}%`, 'info');

        if (this.results.summary.failedTests === 0) {
            this.log('🎉 ALL TESTS PASSED!', 'pass');
        } else {
            this.log(`💥 ${this.results.summary.failedTests} TEST(S) FAILED`, 'fail');
        }
    }

    /**
     * Ensure report directory exists
     */
    async ensureReportDirectory() {
        try {
            await fs.access(this.reportDir);
        } catch {
            await fs.mkdir(this.reportDir, { recursive: true });
        }
    }

    /**
     * Logging utility
     */
    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const colors = {
            'header': '\x1b[96m🚀\x1b[0m', // Cyan
            'pass': '\x1b[92m✅\x1b[0m',   // Green
            'fail': '\x1b[91m❌\x1b[0m',   // Red
            'warn': '\x1b[93m⚠️\x1b[0m',    // Yellow
            'info': '\x1b[94mℹ️\x1b[0m',    // Blue
            'error': '\x1b[91m💥\x1b[0m'    // Red
        };

        const prefix = colors[type] || 'ℹ️';
        console.log(`[${timestamp}] ${prefix} ${message}`);
    }
}

/**
 * Performance Monitor
 * Tracks memory and CPU usage during test execution
 */
class PerformanceMonitor {
    constructor() {
        this.isMonitoring = false;
        this.interval = null;
        this.data = {
            memoryUsage: [],
            cpuUsage: [],
            startTime: null,
            endTime: null
        };
    }

    start() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.data.startTime = Date.now();

        // Sample every 1 second
        this.interval = setInterval(() => {
            this.data.memoryUsage.push(process.memoryUsage());

            // CPU usage is more complex to measure accurately
            // This is a simple approximation
            const usage = process.cpuUsage();
            this.data.cpuUsage.push(usage);
        }, 1000);
    }

    stop() {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;
        this.data.endTime = Date.now();

        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    getResults() {
        return {
            ...this.data,
            duration: this.data.endTime - this.data.startTime,
            peakMemory: Math.max(...this.data.memoryUsage.map(m => m.heapUsed)),
            averageMemory: this.data.memoryUsage.reduce((a, b) => a + b.heapUsed, 0) / this.data.memoryUsage.length
        };
    }
}

module.exports = {
    UnifiedTestFramework,
    PerformanceMonitor
};
