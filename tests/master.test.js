/**
 * Master Test Runner - Orchestrates all test suites
 * Runs environment, stability, and resource tests in sequence
 * Generates comprehensive HTML and JSON test reports
 */

const { EnvironmentTester } = require('./environment.test.js');
const { StabilityTester } = require('./stability.test.js');
const { ResourceTester } = require('./resource.test.js');
const fs = require('fs');
const path = require('path');

class MasterTestRunner {
    constructor() {
        this.results = {
            environment: null,
            stability: null,
            resource: null,
            overall: {
                passed: 0,
                failed: 0,
                warnings: 0,
                startTime: new Date().toISOString(),
                duration: 0,
                testVersion: '1.0.0',
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };
        this.startTime = Date.now();
        this.reportDir = path.join(process.cwd(), 'tests', 'reports');
        this.ensureReportDirectory();
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            'pass': '✅',
            'fail': '❌',
            'warn': '⚠️',
            'info': 'ℹ️',
            'header': '🚀'
        }[type];

        console.log(`[${timestamp}] ${prefix} ${message}`);
    }

    async runAllTestSuites() {
        this.log('=== BAMBISLEEP CHAT - COMPREHENSIVE TEST SUITE ===', 'header');
        this.log('Starting full application testing...', 'info');

        try {
            // 1. Environment Tests - Check system requirements and setup
            this.log('', 'info'); // Empty line for readability
            this.log('Phase 1: Environment Validation', 'header');
            const environmentTester = new EnvironmentTester();
            this.results.environment = await environmentTester.runAllTests();

            // Don't proceed if environment is severely broken
            if (!this.results.environment.success && this.results.environment.results.failed > 3) {
                this.log('Environment has critical issues - aborting remaining tests', 'fail');
                return this.generateFinalReport();
            }

            // 2. Resource Usage Tests - Test system resource consumption
            this.log('', 'info');
            this.log('Phase 2: Resource Usage Analysis', 'header');
            const resourceTester = new ResourceTester();
            this.results.resource = await resourceTester.runAllTests();

            // 3. Stability Tests - Test under load and stress
            this.log('', 'info');
            this.log('Phase 3: Stability & Load Testing', 'header');
            const stabilityTester = new StabilityTester();
            this.results.stability = await stabilityTester.runAllTests();

        } catch (error) {
            this.log(`Critical test error: ${error.message}`, 'fail');
            this.log(error.stack, 'fail');
        }

        return this.generateFinalReport();
    }

    async generateFinalReport() {
        this.results.overall.duration = Date.now() - this.startTime;

        this.log('', 'info');
        this.log('=== FINAL TEST REPORT ===', 'header');

        // Calculate overall statistics
        const suites = ['environment', 'stability', 'resource'];
        let totalPassed = 0;
        let totalFailed = 0;
        let totalWarnings = 0;
        let suitesRun = 0;
        let suitesSuccessful = 0;

        for (const suite of suites) {
            const result = this.results[suite];
            if (result) {
                suitesRun++;
                if (result.success) suitesSuccessful++;

                totalPassed += result.results.passed;
                totalFailed += result.results.failed;
                totalWarnings += result.results.warnings;

                this.log(`${suite.toUpperCase()}: ${result.success ? 'PASS' : 'FAIL'} ` +
                    `(${result.results.passed}✅ ${result.results.failed}❌ ${result.results.warnings}⚠️)`,
                    result.success ? 'pass' : 'fail');
            } else {
                this.log(`${suite.toUpperCase()}: NOT RUN`, 'warn');
            }
        }

        this.results.overall.passed = totalPassed;
        this.results.overall.failed = totalFailed;
        this.results.overall.warnings = totalWarnings;

        this.log('', 'info');
        this.log('SUMMARY:', 'info');
        this.log(`Test Suites: ${suitesSuccessful}/${suitesRun} successful`,
            suitesSuccessful === suitesRun ? 'pass' : 'fail');
        this.log(`Total Tests: ${totalPassed}✅ ${totalFailed}❌ ${totalWarnings}⚠️`, 'info');
        this.log(`Duration: ${(this.results.overall.duration / 1000).toFixed(2)} seconds`, 'info');

        // Performance insights
        if (this.results.stability?.results?.metrics) {
            const metrics = this.results.stability.results.metrics;
            if (metrics.responseTime) {
                this.log(`Avg Response Time: ${metrics.responseTime.average.toFixed(2)}ms`, 'info');
            }
            if (metrics.memoryStability) {
                this.log(`Memory Growth: ${metrics.memoryStability.growthMB.toFixed(2)}MB`, 'info');
            }
        }

        // Overall assessment
        const overallSuccess = totalFailed === 0 && suitesSuccessful === suitesRun;
        const hasWarnings = totalWarnings > 0;

        this.log('', 'info');
        if (overallSuccess && !hasWarnings) {
            this.log('🎉 ALL TESTS PASSED - APPLICATION READY FOR DEPLOYMENT', 'pass');
        } else if (overallSuccess && hasWarnings) {
            this.log('✅ TESTS PASSED WITH WARNINGS - APPLICATION FUNCTIONAL', 'warn');
        } else if (totalFailed < 3) {
            this.log('⚠️ MINOR ISSUES DETECTED - APPLICATION MOSTLY FUNCTIONAL', 'warn');
        } else {
            this.log('❌ SIGNIFICANT ISSUES DETECTED - REVIEW REQUIRED', 'fail');
        }

        // Recommendations
        this.generateRecommendations();

        const finalResult = {
            success: overallSuccess,
            results: this.results,
            summary: {
                suitesRun,
                suitesSuccessful,
                totalPassed,
                totalFailed,
                totalWarnings,
                duration: this.results.overall.duration
            }
        };

        // Generate comprehensive reports
        await this.generateReports(finalResult);

        return finalResult;
    }

    generateRecommendations() {
        this.log('', 'info');
        this.log('RECOMMENDATIONS:', 'info');

        // Environment recommendations
        if (this.results.environment && !this.results.environment.success) {
            this.log('• Fix environment setup issues before deployment', 'warn');
            if (this.results.environment.results.failed > 0) {
                this.log('• Check Node.js version, dependencies, and file permissions', 'info');
            }
        }

        // Resource recommendations
        if (this.results.resource) {
            const resourceResult = this.results.resource.results;
            if (resourceResult.warnings > 2) {
                this.log('• Monitor system resources - consider upgrading hardware', 'warn');
            }
        }

        // Stability recommendations
        if (this.results.stability) {
            const stabilityResult = this.results.stability.results;
            if (stabilityResult.failed > 0) {
                this.log('• Address stability issues before production use', 'warn');
            }

            const metrics = stabilityResult.metrics;
            if (metrics?.memoryStability?.growthMB > 50) {
                this.log('• Investigate potential memory leaks', 'warn');
            }
            if (metrics?.responseTime?.average > 1000) {
                this.log('• Optimize response times for better user experience', 'warn');
            }
        }

        // General recommendations
        this.log('• Run tests regularly during development', 'info');
        this.log('• Monitor production performance with similar metrics', 'info');
        this.log('• Consider setting up automated testing in CI/CD pipeline', 'info');
    }

    ensureReportDirectory() {
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir, { recursive: true });
            this.log(`Created reports directory: ${this.reportDir}`, 'info');
        }
    }

    async generateReports(finalResult) {
        this.log('', 'info');
        this.log('=== GENERATING TEST REPORTS ===', 'header');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseFileName = `bambisleep-test-report-${timestamp}`;

        try {
            // Generate JSON Report
            const jsonReportPath = path.join(this.reportDir, `${baseFileName}.json`);
            await this.generateJSONReport(jsonReportPath, finalResult);

            // Generate HTML Report
            const htmlReportPath = path.join(this.reportDir, `${baseFileName}.html`);
            await this.generateHTMLReport(htmlReportPath, finalResult);

            // Generate Summary Report
            const summaryReportPath = path.join(this.reportDir, 'latest-summary.txt');
            await this.generateSummaryReport(summaryReportPath, finalResult);

            this.log(`✅ JSON Report: ${jsonReportPath}`, 'pass');
            this.log(`✅ HTML Report: ${htmlReportPath}`, 'pass');
            this.log(`✅ Summary Report: ${summaryReportPath}`, 'pass');

        } catch (error) {
            this.log(`❌ Error generating reports: ${error.message}`, 'fail');
        }
    }

    async generateJSONReport(filePath, finalResult) {
        const report = {
            metadata: {
                testSuite: 'BambiSleep Chat Comprehensive Testing',
                version: this.results.overall.testVersion,
                timestamp: this.results.overall.startTime,
                duration: this.results.overall.duration,
                platform: {
                    node: this.results.overall.nodeVersion,
                    os: this.results.overall.platform,
                    arch: this.results.overall.arch
                }
            },
            summary: finalResult.summary,
            results: {
                overall: finalResult.success,
                environment: this.results.environment,
                stability: this.results.stability,
                resource: this.results.resource
            }
        };

        fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    }

    async generateHTMLReport(filePath, finalResult) {
        const html = this.createHTMLReport(finalResult);
        fs.writeFileSync(filePath, html);
    }

    async generateSummaryReport(filePath, finalResult) {
        const summary = this.createTextSummary(finalResult);
        fs.writeFileSync(filePath, summary);
    }

    createHTMLReport(finalResult) {
        const statusColor = finalResult.success ? '#28a745' : '#dc3545';
        const statusText = finalResult.success ? 'PASSED' : 'FAILED';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BambiSleep Chat - Test Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #eee;
        }
        .header h1 {
            color: #333;
            margin: 0;
            font-size: 2.5em;
        }
        .status {
            font-size: 1.5em;
            font-weight: bold;
            color: ${statusColor};
            margin: 10px 0;
        }
        .metadata {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metadata-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }
        .test-section {
            margin-bottom: 30px;
            background: #fff;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.05);
        }
        .test-section h2 {
            color: #333;
            margin-top: 0;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
        }
        .test-result {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
        }
        .test-result.pass { background: #d4edda; color: #155724; }
        .test-result.fail { background: #f8d7da; color: #721c24; }
        .test-result.warn { background: #fff3cd; color: #856404; }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .metric-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #007bff;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
        }
        .recommendations {
            background: #e7f3ff;
            border: 1px solid #b3d7ff;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧠 BambiSleep Chat</h1>
            <h2>Comprehensive Test Report</h2>
            <div class="status">Status: ${statusText}</div>
            <small>Generated: ${new Date(this.results.overall.startTime).toLocaleString()}</small>
        </div>

        <div class="metadata">
            <div class="metadata-item">
                <strong>Duration</strong><br>
                ${(this.results.overall.duration / 1000).toFixed(2)} seconds
            </div>
            <div class="metadata-item">
                <strong>Platform</strong><br>
                ${this.results.overall.platform} ${this.results.overall.arch}
            </div>
            <div class="metadata-item">
                <strong>Node.js</strong><br>
                ${this.results.overall.nodeVersion}
            </div>
            <div class="metadata-item">
                <strong>Test Suites</strong><br>
                ${finalResult.summary.suitesSuccessful}/${finalResult.summary.suitesRun} successful
            </div>
        </div>

        ${this.generateTestSectionHTML('Environment Tests', this.results.environment)}
        ${this.generateTestSectionHTML('Stability Tests', this.results.stability)}
        ${this.generateTestSectionHTML('Resource Tests', this.results.resource)}

        <div class="test-section">
            <h2>📊 Performance Metrics</h2>
            <div class="metrics-grid">
                ${this.generateMetricsHTML()}
            </div>
        </div>

        <div class="recommendations">
            <h3>💡 Recommendations</h3>
            ${this.generateRecommendationsHTML()}
        </div>

        <div class="footer">
            <p>Report generated by BambiSleep Chat Testing Suite v${this.results.overall.testVersion}</p>
            <p>For more information, see <code>tests/README.md</code></p>
        </div>
    </div>
</body>
</html>`;
    }

    generateTestSectionHTML(title, result) {
        if (!result) return '';

        const statusClass = result.success ? 'pass' : 'fail';
        const statusIcon = result.success ? '✅' : '❌';

        return `
        <div class="test-section">
            <h2>${title}</h2>
            <div class="test-result ${statusClass}">
                <span>${statusIcon} Overall Result</span>
                <span>${result.success ? 'PASSED' : 'FAILED'}</span>
            </div>
            <div class="test-result">
                <span>✅ Passed Tests</span>
                <span>${result.results.passed}</span>
            </div>
            <div class="test-result">
                <span>❌ Failed Tests</span>
                <span>${result.results.failed}</span>
            </div>
            <div class="test-result">
                <span>⚠️ Warnings</span>
                <span>${result.results.warnings}</span>
            </div>
        </div>`;
    }

    generateMetricsHTML() {
        let metricsHTML = '';

        // Add response time metrics if available
        if (this.results.stability?.results?.metrics?.responseTime) {
            const rt = this.results.stability.results.metrics.responseTime;
            metricsHTML += `
                <div class="metric-card">
                    <div class="metric-value">${rt.average.toFixed(2)}ms</div>
                    <div class="metric-label">Avg Response Time</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${rt.maximum.toFixed(2)}ms</div>
                    <div class="metric-label">Max Response Time</div>
                </div>`;
        }

        // Add memory metrics if available
        if (this.results.stability?.results?.metrics?.memoryStability) {
            const mem = this.results.stability.results.metrics.memoryStability;
            metricsHTML += `
                <div class="metric-card">
                    <div class="metric-value">${mem.growthMB.toFixed(2)}MB</div>
                    <div class="metric-label">Memory Growth</div>
                </div>`;
        }

        // Add resource metrics if available
        if (this.results.resource?.results?.metrics?.memory?.length > 0) {
            const memData = this.results.resource.results.metrics.memory;
            const avgMem = memData.reduce((sum, m) => sum + m.process.heapUsed, 0) / memData.length / (1024 * 1024);
            metricsHTML += `
                <div class="metric-card">
                    <div class="metric-value">${avgMem.toFixed(2)}MB</div>
                    <div class="metric-label">Avg Memory Usage</div>
                </div>`;
        }

        return metricsHTML || '<div class="metric-card"><div class="metric-label">No metrics available</div></div>';
    }

    generateRecommendationsHTML() {
        const recommendations = [];

        if (!this.results.environment?.success) {
            recommendations.push('🔧 Fix environment setup issues before deployment');
        }

        if (this.results.stability?.results?.metrics?.responseTime?.average > 1000) {
            recommendations.push('⚡ Optimize response times for better user experience');
        }

        if (this.results.stability?.results?.metrics?.memoryStability?.growthMB > 50) {
            recommendations.push('🔍 Investigate potential memory leaks');
        }

        if (this.results.resource?.results?.warnings > 2) {
            recommendations.push('💪 Consider upgrading hardware for better performance');
        }

        recommendations.push('📈 Run tests regularly during development');
        recommendations.push('🔄 Monitor production performance with similar metrics');

        return recommendations.map(rec => `<p>${rec}</p>`).join('');
    }

    createTextSummary(finalResult) {
        return `BambiSleep Chat - Test Summary Report
===========================================

Generated: ${new Date(this.results.overall.startTime).toLocaleString()}
Duration: ${(this.results.overall.duration / 1000).toFixed(2)} seconds
Platform: ${this.results.overall.platform} ${this.results.overall.arch}
Node.js: ${this.results.overall.nodeVersion}

OVERALL STATUS: ${finalResult.success ? 'PASSED' : 'FAILED'}

Test Suite Results:
- Environment: ${this.results.environment?.success ? 'PASS' : 'FAIL'} (${this.results.environment?.results.passed}✅ ${this.results.environment?.results.failed}❌ ${this.results.environment?.results.warnings}⚠️)
- Stability: ${this.results.stability?.success ? 'PASS' : 'FAIL'} (${this.results.stability?.results.passed}✅ ${this.results.stability?.results.failed}❌ ${this.results.stability?.results.warnings}⚠️)
- Resource: ${this.results.resource?.success ? 'PASS' : 'FAIL'} (${this.results.resource?.results.passed}✅ ${this.results.resource?.results.failed}❌ ${this.results.resource?.results.warnings}⚠️)

Summary:
- Test Suites: ${finalResult.summary.suitesSuccessful}/${finalResult.summary.suitesRun} successful
- Total Tests: ${finalResult.summary.totalPassed}✅ ${finalResult.summary.totalFailed}❌ ${finalResult.summary.totalWarnings}⚠️

Performance Metrics:
${this.results.stability?.results?.metrics?.responseTime ?
                `- Average Response Time: ${this.results.stability.results.metrics.responseTime.average.toFixed(2)}ms` :
                '- Response Time: Not measured'
            }
${this.results.stability?.results?.metrics?.memoryStability ?
                `- Memory Growth: ${this.results.stability.results.metrics.memoryStability.growthMB.toFixed(2)}MB` :
                '- Memory Growth: Not measured'
            }

For detailed results, see the full HTML report.
`;
    }
}

// Run if called directly
if (require.main === module) {
    (async () => {
        const runner = new MasterTestRunner();
        const result = await runner.runAllTestSuites();

        // Exit with appropriate code
        process.exit(result.success ? 0 : 1);
    })();
}

module.exports = { MasterTestRunner };
