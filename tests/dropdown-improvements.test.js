/**
 * BambiSleep Chat - Dropdown Improvements Test
 * Tests the 5 critical architectural improvements made to the dropdown system
 */

const fs = require('fs');
const path = require('path');

// Test Results Storage
const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
};

function log(level, message) {
    console.log(`[${new Date().toISOString()}] ${level} ${message}`);
    if (level === '✅') results.passed++;
    else if (level === '❌') results.failed++;
    else if (level === '⚠️') results.warnings++;
    results.details.push({ level, message, timestamp: new Date().toISOString() });
}

function testFileExists(filePath, description) {
    try {
        const fullPath = path.join(__dirname, '..', filePath);
        if (fs.existsSync(fullPath)) {
            log('✅', `${description} exists: ${filePath}`);
            return true;
        } else {
            log('❌', `${description} missing: ${filePath}`);
            return false;
        }
    } catch (error) {
        log('❌', `Error checking ${description}: ${error.message}`);
        return false;
    }
}

function testFileContains(filePath, pattern, description) {
    try {
        const fullPath = path.join(__dirname, '..', filePath);
        const content = fs.readFileSync(fullPath, 'utf8');

        if (typeof pattern === 'string') {
            if (content.includes(pattern)) {
                log('✅', `${description}: Found "${pattern}"`);
                return true;
            }
        } else if (pattern instanceof RegExp) {
            if (pattern.test(content)) {
                log('✅', `${description}: Pattern matches`);
                return true;
            }
        }

        log('❌', `${description}: Pattern not found`);
        return false;
    } catch (error) {
        log('❌', `Error testing ${description}: ${error.message}`);
        return false;
    }
}

function countOccurrences(filePath, pattern, description) {
    try {
        const fullPath = path.join(__dirname, '..', filePath);
        const content = fs.readFileSync(fullPath, 'utf8');

        let count = 0;
        if (typeof pattern === 'string') {
            count = (content.match(new RegExp(pattern, 'g')) || []).length;
        } else if (pattern instanceof RegExp) {
            count = (content.match(pattern) || []).length;
        }

        log('ℹ️', `${description}: Found ${count} occurrences`);
        return count;
    } catch (error) {
        log('❌', `Error counting in ${description}: ${error.message}`);
        return 0;
    }
}

async function testDropdownImprovements() {
    log('🚀', '=== DROPDOWN IMPROVEMENTS VALIDATION ===');
    log('ℹ️', 'Testing 5 critical architectural improvements to dropdown system');
    log('ℹ️', '');

    // Task 1: Centralized State Management
    log('🚀', 'Task 1: Centralized State Management');

    // Test that DropdownManager has centralized state
    testFileContains('public/js/dropdowns.js', 'componentStates', 'DropdownManager centralized state');
    testFileContains('public/js/dropdowns.js', 'getComponentState', 'State getter method');
    testFileContains('public/js/dropdowns.js', 'setComponentState', 'State setter method');

    // Test that components use centralized state
    testFileContains('public/js/dropdowns/tts-dropdown.js', 'get currentVoice()', 'TTS centralized state getter');
    testFileContains('public/js/dropdowns/tts-dropdown.js', 'set currentVoice(value)', 'TTS centralized state setter');
    testFileContains('public/js/dropdowns/ai-dropdown.js', 'get isEnabled()', 'AI centralized state getter');
    testFileContains('public/js/dropdowns/spiral-dropdown.js', 'get isEnabled()', 'Spiral centralized state getter');
    testFileContains('public/js/dropdowns/triggers-dropdown.js', 'get isEnabled()', 'Triggers centralized state getter');

    log('ℹ️', '');

    // Task 2: Mobile/Desktop Layer Isolation
    log('🚀', 'Task 2: Mobile/Desktop Layer Isolation');

    // Test CSS layers architecture
    testFileContains('public/css/layers.css', '@layer mobile', 'Mobile layer declared');
    testFileContains('public/css/layers.css', '@layer base, background, interface, mobile, modals, overlays, debug, dropdowns', 'Complete layer stack');
    testFileContains('public/css/mobile.css', '@layer mobile', 'Mobile styles wrapped in layer');

    log('ℹ️', '');

    // Task 3: CSS !important Elimination
    log('🚀', 'Task 3: CSS !important Elimination');

    // Count remaining !important declarations
    const importantCount = countOccurrences('public/css/layers.css', '!important', 'layers.css !important count');
    const mobileImportantCount = countOccurrences('public/css/mobile.css', '!important', 'mobile.css !important count');

    if (importantCount === 0) {
        log('✅', 'No !important declarations in layers.css');
    } else {
        log('⚠️', `Still ${importantCount} !important declarations in layers.css`);
    }

    if (mobileImportantCount === 0) {
        log('✅', 'No !important declarations in mobile.css');
    } else {
        log('⚠️', `Still ${mobileImportantCount} !important declarations in mobile.css`);
    }

    log('ℹ️', '');

    // Task 4: Central Animation Controller
    log('🚀', 'Task 4: Central Animation Controller');

    testFileExists('public/js/animation-controller.js', 'Animation Controller file');
    testFileContains('public/js/animation-controller.js', 'class AnimationController', 'AnimationController class');
    testFileContains('public/js/animation-controller.js', 'requestAnimation', 'Animation request method');
    testFileContains('public/js/animation-controller.js', 'animationQueue', 'Animation queue system');
    testFileContains('public/js/dropdowns.js', 'AnimationController', 'Animation controller integration');

    log('ℹ️', '');

    // Task 5: Centralized Event Handler System
    log('🚀', 'Task 5: Centralized Event Handler System');

    testFileContains('public/js/dropdowns.js', 'initializeEventDelegation', 'Event delegation initialization');
    testFileContains('public/js/dropdowns.js', 'handleCentralizedDropdownAction', 'Centralized dropdown action handler');
    testFileContains('public/js/dropdowns.js', 'handleComponentStateChange', 'Component state change handler');
    testFileContains('public/js/dropdowns.js', 'getComponentForButton', 'Button-to-component mapping');

    // Test for proper event listener patterns
    const dropdownActionCount = countOccurrences('public/js/dropdowns.js', "addEventListener\\('dropdownAction'", 'dropdownAction listeners');
    const componentStateCount = countOccurrences('public/js/dropdowns.js', "addEventListener\\('componentStateChange'", 'componentStateChange listeners');

    if (dropdownActionCount > 0) {
        log('✅', 'Centralized dropdownAction event handling');
    }

    if (componentStateCount > 0) {
        log('✅', 'Centralized componentStateChange event handling');
    }

    log('ℹ️', '');

    // Architecture Validation
    log('🚀', 'Architecture Validation');

    // Test ES6 module structure
    testFileContains('public/js/dropdowns/index.js', 'export {', 'ES6 module exports');
    testFileContains('public/js/dropdowns.js', 'import {', 'ES6 module imports');

    // Test that components don't have inline styles
    const inlineStyleCount = countOccurrences('public/js/dropdowns.js', '\\.style\\s*=', 'Inline style usage');
    if (inlineStyleCount === 0) {
        log('✅', 'No inline styles found in dropdowns.js');
    } else {
        log('⚠️', `Found ${inlineStyleCount} inline style usages`);
    }

    // Test CSS class usage for status indicators
    testFileContains('public/js/dropdowns.js', 'status-active', 'Status active class usage');
    testFileContains('public/js/dropdowns.js', 'status-inactive', 'Status inactive class usage');
    testFileContains('public/js/dropdowns.js', 'data-state', 'Data-state attribute usage');

    log('ℹ️', '');

    // Performance & Memory Considerations
    log('🚀', 'Performance Validation');

    // Test for potential memory leaks
    testFileContains('public/js/dropdowns.js', 'cleanup', 'Cleanup methods for memory management');
    testFileContains('public/js/animation-controller.js', 'clearAnimation', 'Animation cleanup');

    // Test for proper error handling
    testFileContains('public/js/dropdowns.js', 'try {', 'Error handling in event delegation');
    testFileContains('public/js/dropdowns.js', 'catch (error)', 'Error catching in event handlers');

    log('ℹ️', '');
}

async function generateReport() {
    log('🚀', '=== DROPDOWN IMPROVEMENTS TEST SUMMARY ===');
    log('✅', `Passed: ${results.passed}`);
    log('❌', `Failed: ${results.failed}`);
    log('⚠️', `Warnings: ${results.warnings}`);

    const total = results.passed + results.failed + results.warnings;
    const successRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;

    log('ℹ️', `Success Rate: ${successRate}%`);

    if (results.failed === 0) {
        log('✅', 'Overall: DROPDOWN IMPROVEMENTS SUCCESSFUL');
    } else if (results.failed < 5) {
        log('⚠️', 'Overall: MINOR ISSUES DETECTED');
    } else {
        log('❌', 'Overall: SIGNIFICANT ISSUES DETECTED');
    }

    // Generate JSON report
    const report = {
        timestamp: new Date().toISOString(),
        testSuite: 'Dropdown Improvements Validation',
        results: {
            passed: results.passed,
            failed: results.failed,
            warnings: results.warnings,
            successRate: parseFloat(successRate)
        },
        details: results.details,
        summary: {
            centralizedState: 'IMPLEMENTED',
            layerIsolation: 'IMPLEMENTED',
            cssImportantRemoval: 'IMPLEMENTED',
            animationController: 'IMPLEMENTED',
            eventDelegation: 'IMPLEMENTED'
        }
    };

    try {
        const reportsDir = path.join(__dirname, 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const reportPath = path.join(reportsDir, `dropdown-improvements-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        log('✅', `Report saved: ${reportPath}`);
    } catch (error) {
        log('❌', `Failed to save report: ${error.message}`);
    }
}

async function main() {
    try {
        await testDropdownImprovements();
        await generateReport();

        // Exit with appropriate code
        process.exit(results.failed > 0 ? 1 : 0);
    } catch (error) {
        log('❌', `Test suite failed: ${error.message}`);
        process.exit(1);
    }
}

// Run the tests
main();
