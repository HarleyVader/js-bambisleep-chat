/**
 * Unified Test Runner v2.0 - Future-Proof Testing System
 * Centralized, modular, and extensible test execution
 *
 * Features:
 * - Automatic test suite discovery
 * - Parallel and sequential execution
 * - Comprehensive reporting (HTML, JSON, Text)
 * - Performance monitoring
 * - CI/CD integration ready
 * - Plugin system for custom reporters
 * - Real-time progress tracking
 */

const { UnifiedTestFramework } = require('./unified-test-framework.js');
const path = require('path');
const fs = require('fs').promises;

/**
 * Main test runner configuration and execution
 */
class BambiSleepTestRunner {
    constructor() {
        this.framework = new UnifiedTestFramework({
            parallel: process.env.TEST_PARALLEL !== 'false',
            timeout: parseInt(process.env.TEST_TIMEOUT) || 300000, // 5 minutes
            verbose: process.env.TEST_VERBOSE === 'true',
            generateReports: process.env.TEST_REPORTS !== 'false',
            exitOnFailure: process.env.TEST_EXIT_ON_FAILURE !== 'false'
        });

        this.setupFramework();
    }

    /**
     * Configure the test framework
     */
    setupFramework() {
        // Add lifecycle hooks
        this.framework.beforeAll(async () => {
            console.log('🚀 BambiSleep Chat - Unified Test Suite v2.0');
            console.log('📅 Starting comprehensive testing...');

            // Ensure report directory exists
            const reportDir = path.join(process.cwd(), 'tests', 'reports');
            try {
                await fs.access(reportDir);
            } catch {
                await fs.mkdir(reportDir, { recursive: true });
            }
        });

        this.framework.afterAll(async (context) => {
            console.log('🏁 All tests completed');
            console.log(`📊 Final Results: ${context.results?.summary?.passedTests || 0}✅ ${context.results?.summary?.failedTests || 0}❌`);
        });

        this.framework.beforeEach(async (context) => {
            if (context.suite) {
                console.log(`\n🔄 Starting suite: ${context.suite.name}`);
            }
        });

        this.framework.afterEach(async (context) => {
            if (context.result) {
                const { result } = context;
                const emoji = result.status === 'passed' ? '✅' : (result.status === 'failed' ? '❌' : '⚠️');
                console.log(`${emoji} Suite completed: ${result.name} (${result.duration}ms)`);
            }
        });

        // Add custom reporters
        this.framework.addReporter(this.slackReporter.bind(this));
        this.framework.addReporter(this.ciReporter.bind(this));
    }

    /**
     * Register all test suites
     */
    async registerTestSuites() {
        console.log('📋 Registering test suites...');

        // Register modern test suites (v2.0 compatible)
        try {
            // Environment tests - highest priority
            const envSuite = require('./environment-v2.test.js');
            this.framework.registerSuite('environment', envSuite.testSuite, {
                ...envSuite.config,
                tags: ['critical', 'environment', 'setup'],
                priority: 100
            });

            // Architecture tests - high priority
            const archSuite = require('./architecture-v2.test.js');
            this.framework.registerSuite('architecture', archSuite.testSuite, {
                ...archSuite.config,
                tags: ['critical', 'architecture', 'dropdowns'],
                priority: 90,
                dependencies: ['environment']
            });

            // Stability tests - medium priority
            const stabilitySuite = require('./stability-v2.test.js');
            this.framework.registerSuite('stability', stabilitySuite.testSuite, {
                ...stabilitySuite.config,
                tags: ['important', 'stability', 'performance'],
                priority: 80,
                dependencies: ['environment']
            });

            // MCP Tools Integration tests - high priority
            try {
                const mcpSuite = require('./mcp-tools.test.js');
                this.framework.registerSuite('mcp-tools', mcpSuite.testSuite, {
                    tags: ['critical', 'mcp', 'integration', 'api'],
                    priority: 85,
                    dependencies: ['environment'],
                    timeout: 60000 // 1 minute for API calls
                });
            } catch (error) {
                console.log('⚠️  MCP test suite not available (optional)');
            }

            console.log('✅ Modern test suites registered');

        } catch (error) {
            console.error(`❌ Error registering modern test suites: ${error.message}`);
        }

    }    /**
     * Run all tests with optional filtering
     */
    async run(filterTags = []) {
        // Parse command line arguments for tags
        const args = process.argv.slice(2);
        const tagArgs = args.filter(arg => arg.startsWith('--tag=')).map(arg => arg.split('=')[1]);
        const allTags = [...filterTags, ...tagArgs];

        console.log('🎯 Filter tags:', allTags.length > 0 ? allTags.join(', ') : 'None (running all tests)');

        try {
            // Register all test suites
            await this.registerTestSuites();

            // Run tests
            const results = await this.framework.run(allTags);

            // Generate additional reports
            await this.generateSummaryReport(results);

            return results;

        } catch (error) {
            console.error(`💥 Test runner failed: ${error.message}`);

            if (process.env.TEST_VERBOSE === 'true') {
                console.error(error.stack);
            }

            process.exit(1);
        }
    }

    /**
     * Generate enhanced summary report
     */
    async generateSummaryReport(results) {
        const summary = `
BambiSleep Chat - Test Execution Summary
======================================

🎯 Test Framework: Unified Testing v${this.framework.version}
📅 Execution Time: ${results.framework.endTime}
⏱️ Duration: ${(results.framework.duration / 1000).toFixed(2)} seconds
💻 Environment: Node ${results.framework.nodeVersion} on ${results.framework.platform}

📊 RESULTS OVERVIEW
==================
Total Test Suites: ${results.summary.totalSuites}
✅ Passed Suites: ${results.summary.passedSuites}
❌ Failed Suites: ${results.summary.failedSuites}
⏭️ Skipped Suites: ${results.summary.skippedSuites}

Total Tests: ${results.summary.totalTests}
✅ Passed: ${results.summary.passedTests}
❌ Failed: ${results.summary.failedTests}
⚠️ Warnings: ${results.summary.warningTests}
⏭️ Skipped: ${results.summary.skippedTests}

🎯 Success Rate: ${((results.summary.passedTests / results.summary.totalTests) * 100).toFixed(1)}%

📈 PERFORMANCE METRICS
=====================
Peak Memory: ${(results.performance.peakMemory / 1024 / 1024).toFixed(2)} MB
Average Memory: ${(results.performance.averageMemory / 1024 / 1024).toFixed(2)} MB
Memory Samples: ${results.performance.memoryUsage.length}

🏆 SUITE RESULTS
===============
${results.suites.map(suite => {
            const status = suite.status === 'passed' ? '✅' : (suite.status === 'failed' ? '❌' : '⚠️');
            return `${status} ${suite.name} (${suite.duration}ms)
   ${suite.passed}✅ ${suite.failed}❌ ${suite.warnings}⚠️ ${suite.skipped}⏭️`;
        }).join('\n')}

${results.summary.failedTests === 0
                ? '🎉 ALL TESTS PASSED! System is ready for production.'
                : `💥 ${results.summary.failedTests} TEST(S) FAILED - Review required before deployment.`
            }

Generated by BambiSleep Chat Unified Test Framework v${this.framework.version}
`;

        // Write enhanced summary
        const summaryPath = path.join(process.cwd(), 'tests', 'reports', 'unified-test-summary.txt');
        await fs.writeFile(summaryPath, summary);

        console.log(`📄 Enhanced summary: ${summaryPath}`);
    }

    /**
     * Slack reporter for CI/CD integration
     */
    async slackReporter(results, reportDir) {
        if (!process.env.SLACK_WEBHOOK_URL) return;

        const color = results.summary.failedTests === 0 ? 'good' : 'danger';
        const emoji = results.summary.failedTests === 0 ? '🎉' : '💥';

        const payload = {
            text: `${emoji} BambiSleep Chat Test Results`,
            attachments: [{
                color,
                fields: [
                    { title: 'Tests', value: `${results.summary.passedTests}✅ ${results.summary.failedTests}❌`, short: true },
                    { title: 'Duration', value: `${(results.framework.duration / 1000).toFixed(1)}s`, short: true },
                    { title: 'Success Rate', value: `${((results.summary.passedTests / results.summary.totalTests) * 100).toFixed(1)}%`, short: true }
                ]
            }]
        };

        try {
            const https = require('https');
            const url = require('url');

            const webhookUrl = new url.URL(process.env.SLACK_WEBHOOK_URL);
            const postData = JSON.stringify(payload);

            const options = {
                hostname: webhookUrl.hostname,
                port: 443,
                path: webhookUrl.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options);
            req.write(postData);
            req.end();

        } catch (error) {
            console.warn(`⚠️ Slack notification failed: ${error.message}`);
        }
    }

    /**
     * CI/CD reporter for build systems
     */
    async ciReporter(results, reportDir) {
        const ciData = {
            framework: 'BambiSleep-Unified-Tests-v2',
            version: this.framework.version,
            timestamp: results.framework.endTime,
            duration: results.framework.duration,
            environment: {
                node: results.framework.nodeVersion,
                platform: results.framework.platform,
                arch: results.framework.arch
            },
            summary: results.summary,
            performance: {
                peakMemoryMB: (results.performance.peakMemory / 1024 / 1024).toFixed(2),
                averageMemoryMB: (results.performance.averageMemory / 1024 / 1024).toFixed(2)
            },
            suites: results.suites.map(suite => ({
                name: suite.name,
                status: suite.status,
                duration: suite.duration,
                tests: {
                    passed: suite.passed,
                    failed: suite.failed,
                    warnings: suite.warnings,
                    skipped: suite.skipped
                }
            }))
        };

        // Write CI-friendly JSON
        const ciReportPath = path.join(reportDir, 'ci-test-results.json');
        await fs.writeFile(ciReportPath, JSON.stringify(ciData, null, 2));

        // Set CI environment variables if in CI
        if (process.env.CI || process.env.GITHUB_ACTIONS) {
            console.log(`::set-output name=test-results::${JSON.stringify(results.summary)}`);
            console.log(`::set-output name=success-rate::${((results.summary.passedTests / results.summary.totalTests) * 100).toFixed(1)}`);

            if (results.summary.failedTests > 0) {
                console.log(`::error::${results.summary.failedTests} test(s) failed`);
            }
        }
    }
}

/**
 * CLI interface and main execution
 */
async function main() {
    const runner = new BambiSleepTestRunner();

    try {
        // Parse command line arguments
        const args = process.argv.slice(2);

        if (args.includes('--help') || args.includes('-h')) {
            console.log(`
BambiSleep Chat - Unified Test Framework v2.0

Usage:
  npm test                    Run all tests
  npm test -- --tag=critical Run tests tagged 'critical'
  npm test -- --tag=environment --tag=architecture
                              Run specific test categories

Environment Variables:
  TEST_PARALLEL=false         Disable parallel execution
  TEST_TIMEOUT=300000         Set timeout in milliseconds
  TEST_VERBOSE=true           Enable verbose output
  TEST_REPORTS=false          Disable report generation
  TEST_EXIT_ON_FAILURE=false  Don't exit on test failure
  SLACK_WEBHOOK_URL=...       Enable Slack notifications

Examples:
  npm test -- --tag=critical     # Run only critical tests
  npm test -- --tag=architecture # Run architecture tests only
  TEST_VERBOSE=true npm test      # Run with verbose output
            `);
            return;
        }

        // Extract tag filters
        const tagArgs = args.filter(arg => arg.startsWith('--tag=')).map(arg => arg.split('=')[1]);

        // Run tests
        const results = await runner.run(tagArgs);

        // Exit with appropriate code
        process.exit(results.summary.failedTests > 0 ? 1 : 0);

    } catch (error) {
        console.error(`💥 Test execution failed: ${error.message}`);
        process.exit(1);
    }
}

// Export for programmatic use
module.exports = { BambiSleepTestRunner, UnifiedTestFramework };

// Run if called directly
if (require.main === module) {
    main();
}
