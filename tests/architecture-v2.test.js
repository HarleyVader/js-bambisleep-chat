/**
 * Modern Architecture Test Suite
 * Tests dropdown improvements, CSS layers, and architectural components
 * Compatible with Unified Test Framework v2.0
 */

const fs = require('fs').promises;
const path = require('path');

class ArchitectureTestSuite {
    constructor() {
        this.name = 'Architecture Validation';
        this.description = 'Validates modern architecture: dropdown improvements, CSS layers, centralized state, animation controller';
        this.tags = ['architecture', 'dropdowns', 'css', 'state', 'animation'];
        this.priority = 60; // Medium priority
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
            // Dropdown System Tests
            { name: 'Centralized State Management', test: () => this.testCentralizedState() },
            { name: 'Event Delegation System', test: () => this.testEventDelegation() },
            { name: 'CSS Layers Architecture', test: () => this.testCSSLayers() },
            { name: 'Animation Controller', test: () => this.testAnimationController() },
            { name: 'Component Registration', test: () => this.testComponentRegistration() },

            // Code Quality Tests
            { name: 'No Inline Styles', test: () => this.testNoInlineStyles() },
            { name: 'Error Handling', test: () => this.testErrorHandling() },
            { name: 'Memory Management', test: () => this.testMemoryManagement() },
            { name: 'ES6 Module Structure', test: () => this.testES6Modules() },

            // Integration Tests
            { name: 'Dropdown Components', test: () => this.testDropdownComponents() },
            { name: 'Universal Button States', test: () => this.testUniversalButtonStates() },
            { name: 'Configuration System', test: () => this.testConfigurationSystem() }
        ];

        for (const testDef of tests) {
            const testResult = await this.executeTest(testDef);
            results.tests.push(testResult);

            if (testResult.status === 'passed') results.passed++;
            else if (testResult.status === 'failed') results.failed++;
            else if (testResult.status === 'warning') results.warnings++;
            else if (testResult.status === 'skipped') results.skipped++;
        }

        return results;
    }

    async executeTest(testDef) {
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

        } catch (error) {
            testResult.status = 'failed';
            testResult.message = `Test execution failed: ${error.message}`;
            testResult.details = { error: error.stack };
        }

        testResult.endTime = Date.now();
        testResult.duration = testResult.endTime - testResult.startTime;
        this.logTestResult(testResult);

        return testResult;
    }

    async testCentralizedState() {
        const checks = [
            { file: 'public/js/dropdowns.js', pattern: 'componentStates', description: 'DropdownManager centralized state' },
            { file: 'public/js/dropdowns.js', pattern: 'getComponentState', description: 'State getter method' },
            { file: 'public/js/dropdowns.js', pattern: 'setComponentState', description: 'State setter method' },
            { file: 'public/js/dropdowns/tts-dropdown.js', pattern: 'get currentVoice()', description: 'TTS centralized getter' },
            { file: 'public/js/dropdowns/ai-dropdown.js', pattern: 'get isEnabled()', description: 'AI centralized getter' },
            { file: 'public/js/dropdowns/brainwave-dropdown.js', pattern: 'get isEnabled()', description: 'Brainwave centralized getter' }
        ];

        return await this.performPatternChecks(checks, 'Centralized State Management');
    }

    async testEventDelegation() {
        const checks = [
            { file: 'public/js/dropdowns.js', pattern: 'initializeEventDelegation', description: 'Event delegation initialization' },
            { file: 'public/js/dropdowns.js', pattern: 'handleCentralizedDropdownAction', description: 'Centralized action handler' },
            { file: 'public/js/dropdowns.js', pattern: 'addEventListener(\'dropdownAction\'', description: 'DropdownAction listener' },
            { file: 'public/js/dropdowns.js', pattern: 'getComponentForButton', description: 'Button-to-component mapping' }
        ];

        return await this.performPatternChecks(checks, 'Event Delegation System');
    }

    async testCSSLayers() {
        const checks = [
            { file: 'public/css/layers.css', pattern: '@layer base, background, interface, mobile, modals, overlays, debug, dropdowns', description: 'Complete layer stack' },
            { file: 'public/css/layers.css', pattern: '@layer mobile', description: 'Mobile layer declared' },
            { file: 'public/css/mobile.css', pattern: '@layer mobile', description: 'Mobile styles wrapped' }
        ];

        // Check for reduced !important usage
        const layersContent = await this.readFileContent('public/css/layers.css');
        const mobileContent = await this.readFileContent('public/css/mobile.css');

        const layersImportantCount = (layersContent.match(/!important/g) || []).length;
        const mobileImportantCount = (mobileContent.match(/!important/g) || []).length;

        const result = await this.performPatternChecks(checks, 'CSS Layers Architecture');

        // Add !important usage details
        result.details.importantUsage = {
            layersFile: layersImportantCount,
            mobileFile: mobileImportantCount,
            total: layersImportantCount + mobileImportantCount,
            acceptable: layersImportantCount <= 2 && mobileImportantCount <= 20 // Reasonable limits
        };

        if (layersImportantCount > 2) {
            result.warning = true;
            result.message += ` (Warning: ${layersImportantCount} !important in layers.css)`;
        }

        return result;
    }

    async testAnimationController() {
        const checks = [
            { file: 'public/js/animation-controller.js', pattern: 'class AnimationController', description: 'AnimationController class' },
            { file: 'public/js/animation-controller.js', pattern: 'requestAnimation', description: 'Animation request method' },
            { file: 'public/js/animation-controller.js', pattern: 'animationQueue', description: 'Animation queue system' },
            { file: 'public/js/dropdowns.js', pattern: 'AnimationController', description: 'Animation controller integration' }
        ];

        return await this.performPatternChecks(checks, 'Animation Controller');
    }

    async testComponentRegistration() {
        const checks = [
            { file: 'public/js/dropdowns/index.js', pattern: 'export {', description: 'ES6 module exports' },
            { file: 'public/js/dropdowns.js', pattern: 'import {', description: 'ES6 module imports' },
            { file: 'public/js/dropdowns.js', pattern: 'this.components.tts = new TTSDropdown', description: 'TTS component registration' },
            { file: 'public/js/dropdowns.js', pattern: 'this.components.brainwave = new BrainwaveDropdown', description: 'Brainwave component registration' }
        ];

        return await this.performPatternChecks(checks, 'Component Registration');
    }

    async testNoInlineStyles() {
        const dropdownFiles = [
            'public/js/dropdowns.js',
            'public/js/dropdowns/tts-dropdown.js',
            'public/js/dropdowns/ai-dropdown.js',
            'public/js/dropdowns/spiral-dropdown.js',
            'public/js/dropdowns/collar-dropdown.js',
            'public/js/dropdowns/triggers-dropdown.js',
            'public/js/dropdowns/brainwave-dropdown.js'
        ];

        let totalInlineStyles = 0;
        const fileResults = [];

        for (const file of dropdownFiles) {
            try {
                const content = await this.readFileContent(file);
                const inlineStyleCount = (content.match(/\.style\s*=/g) || []).length;
                totalInlineStyles += inlineStyleCount;

                fileResults.push({
                    file,
                    inlineStyles: inlineStyleCount,
                    clean: inlineStyleCount === 0
                });
            } catch (error) {
                fileResults.push({
                    file,
                    error: error.message,
                    clean: false
                });
            }
        }

        const allClean = totalInlineStyles === 0;

        return {
            passed: allClean,
            message: allClean
                ? 'No inline styles found - using CSS classes'
                : `Found ${totalInlineStyles} inline style usages`,
            details: {
                totalInlineStyles,
                filesChecked: dropdownFiles.length,
                cleanFiles: fileResults.filter(f => f.clean).length,
                fileResults
            }
        };
    }

    async testErrorHandling() {
        const checks = [
            { file: 'public/js/dropdowns.js', pattern: 'try {', description: 'Try-catch blocks' },
            { file: 'public/js/dropdowns.js', pattern: 'catch (error)', description: 'Error catching' },
            { file: 'public/js/dropdowns/brainwave-dropdown.js', pattern: 'showError(message)', description: 'Error display methods' },
            { file: 'public/js/animation-controller.js', pattern: 'console.error', description: 'Error logging' }
        ];

        return await this.performPatternChecks(checks, 'Error Handling');
    }

    async testMemoryManagement() {
        const checks = [
            { file: 'public/js/dropdowns.js', pattern: 'cleanup', description: 'Cleanup methods' },
            { file: 'public/js/dropdowns/brainwave-dropdown.js', pattern: 'cleanup()', description: 'Component cleanup' },
            { file: 'public/js/dropdowns/tts-dropdown.js', pattern: 'removeEventListener', description: 'Event listener cleanup' },
            { file: 'public/js/animation-controller.js', pattern: 'cancelAnimationFrame', description: 'Animation cleanup' }
        ];

        return await this.performPatternChecks(checks, 'Memory Management');
    }

    async testES6Modules() {
        const moduleFiles = [
            'public/js/dropdowns/index.js',
            'public/js/dropdowns/tts-dropdown.js',
            'public/js/dropdowns/ai-dropdown.js',
            'public/js/dropdowns/brainwave-dropdown.js'
        ];

        let allValid = true;
        const results = [];

        for (const file of moduleFiles) {
            try {
                const content = await this.readFileContent(file);

                const hasExport = /export\s+(class|function|{|default)/.test(content);
                const hasImport = /import\s+.+from/.test(content) || !content.includes('import'); // Some files may not import

                const isValid = hasExport;
                if (!isValid) allValid = false;

                results.push({
                    file,
                    hasExport,
                    hasImport,
                    isValid
                });

            } catch (error) {
                results.push({
                    file,
                    error: error.message,
                    isValid: false
                });
                allValid = false;
            }
        }

        return {
            passed: allValid,
            message: allValid
                ? 'ES6 module structure valid'
                : 'ES6 module structure issues detected',
            details: {
                filesChecked: moduleFiles.length,
                validFiles: results.filter(r => r.isValid).length,
                results
            }
        };
    }

    async testDropdownComponents() {
        const components = [
            { name: 'TTS', file: 'public/js/dropdowns/tts-dropdown.js', class: 'TTSDropdown' },
            { name: 'AI', file: 'public/js/dropdowns/ai-dropdown.js', class: 'AIDropdown' },
            { name: 'Spiral', file: 'public/js/dropdowns/spiral-dropdown.js', class: 'SpiralDropdown' },
            { name: 'Collar', file: 'public/js/dropdowns/collar-dropdown.js', class: 'CollarDropdown' },
            { name: 'Triggers', file: 'public/js/dropdowns/triggers-dropdown.js', class: 'TriggersDropdown' },
            { name: 'Brainwave', file: 'public/js/dropdowns/brainwave-dropdown.js', class: 'BrainwaveDropdown' }
        ];

        let allValid = true;
        const results = [];

        for (const component of components) {
            try {
                const content = await this.readFileContent(component.file);

                const hasClass = content.includes(`class ${component.class}`);
                const hasConstructor = content.includes('constructor(');
                const hasStateGetters = /get\s+\w+\(\s*\)/.test(content);
                const hasEventListeners = content.includes('addEventListener');

                const isValid = hasClass && hasConstructor && (hasStateGetters || hasEventListeners);
                if (!isValid) allValid = false;

                results.push({
                    name: component.name,
                    file: component.file,
                    hasClass,
                    hasConstructor,
                    hasStateGetters,
                    hasEventListeners,
                    isValid
                });

            } catch (error) {
                results.push({
                    name: component.name,
                    file: component.file,
                    error: error.message,
                    isValid: false
                });
                allValid = false;
            }
        }

        return {
            passed: allValid,
            message: allValid
                ? `All ${components.length} dropdown components valid`
                : `Dropdown component issues detected`,
            details: {
                componentsChecked: components.length,
                validComponents: results.filter(r => r.isValid).length,
                results
            }
        };
    }

    async testUniversalButtonStates() {
        const checks = [
            { file: 'public/js/dropdowns.js', pattern: 'status-active', description: 'Status active class usage' },
            { file: 'public/js/dropdowns.js', pattern: 'status-inactive', description: 'Status inactive class usage' },
            { file: 'public/js/dropdowns.js', pattern: 'data-state', description: 'Data-state attribute usage' },
            { file: 'public/css/layers.css', pattern: '.status-active', description: 'Status active CSS definition' }
        ];

        return await this.performPatternChecks(checks, 'Universal Button States');
    }

    async testConfigurationSystem() {
        const checks = [
            { file: 'config/env.js', pattern: 'module.exports', description: 'Environment config export' },
            { file: 'workers/triggers.json', pattern: '"Primary"', description: 'Triggers configuration' },
            { file: 'vite.config.js', pattern: 'export default', description: 'Vite configuration' }
        ];

        return await this.performPatternChecks(checks, 'Configuration System');
    }

    // Helper methods
    async performPatternChecks(checks, testName) {
        let passed = 0;
        let failed = 0;
        const results = [];

        for (const check of checks) {
            try {
                const content = await this.readFileContent(check.file);
                const found = content.includes(check.pattern);

                results.push({
                    file: check.file,
                    pattern: check.pattern,
                    description: check.description,
                    found
                });

                if (found) passed++;
                else failed++;

            } catch (error) {
                results.push({
                    file: check.file,
                    pattern: check.pattern,
                    description: check.description,
                    found: false,
                    error: error.message
                });
                failed++;
            }
        }

        const success = failed === 0;
        const successRate = ((passed / checks.length) * 100).toFixed(1);

        return {
            passed: success,
            warning: passed > 0 && failed > 0,
            message: success
                ? `${testName}: All checks passed (${passed}/${checks.length})`
                : `${testName}: ${failed} checks failed (${successRate}% success)`,
            details: {
                totalChecks: checks.length,
                passed,
                failed,
                successRate: parseFloat(successRate),
                results
            }
        };
    }

    async readFileContent(filePath) {
        try {
            return await fs.readFile(filePath, 'utf8');
        } catch (error) {
            throw new Error(`Failed to read ${filePath}: ${error.message}`);
        }
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
const architectureTestSuite = new ArchitectureTestSuite();

module.exports = {
    // Unified framework compatible
    testSuite: architectureTestSuite,
    config: {
        name: 'architecture',
        description: architectureTestSuite.description,
        tags: architectureTestSuite.tags,
        priority: architectureTestSuite.priority,
        timeout: 30000,
        enabled: true,
        dependencies: ['environment']
    },

    // Legacy compatibility
    default: architectureTestSuite
};
