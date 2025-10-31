#!/usr/bin/env node
/**
 * Enhanced Clean Script for BambiSleep Chat v0.3.0
 * Removes build artifacts, test reports, cache files, and temporary data
 * Supports unified test framework v2.0 and modern project structure
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Clean levels configuration
const CLEAN_LEVELS = {
    // Light clean - only temporary files and test reports
    light: {
        paths: [
            'tests/.write-test-temp'
        ],
        testReports: true,
        cacheFiles: false,
        dependencies: false,
        description: '🧹 Light clean: test reports and temporary files'
    },

    // Standard clean - includes cache and build artifacts
    standard: {
        paths: [
            'public/dist',
            'tests/.write-test-temp',
            '.vite',
            'coverage'
        ],
        testReports: true,
        cacheFiles: true,
        dependencies: false,
        description: '🧹 Standard clean: build artifacts, cache, and test reports'
    },

    // Full clean - everything including dependencies
    full: {
        paths: [
            'node_modules',
            'public/dist',
            'package-lock.json',
            'tests/.write-test-temp',
            '.vite',
            'coverage'
        ],
        testReports: true,
        cacheFiles: true,
        dependencies: true,
        description: '🧹 Full clean: everything including node_modules'
    }
};

// Unified test framework report patterns
const testReportPatterns = [
    // Legacy patterns (still supported)
    { dir: 'tests/reports', pattern: /^bambisleep-.*\.html$/, description: 'Legacy HTML reports' },
    { dir: 'tests/reports', pattern: /^bambisleep-.*\.json$/, description: 'Legacy JSON reports' },

    // Unified test framework v2.0 patterns
    { dir: 'tests/reports', pattern: /^unified-test-report-.*\.html$/, description: 'Unified HTML reports' },
    { dir: 'tests/reports', pattern: /^unified-test-report-.*\.json$/, description: 'Unified JSON reports' },
    { dir: 'tests/reports', file: 'latest-unified-summary.txt', description: 'Latest unified summary' },
    { dir: 'tests/reports', file: 'unified-test-summary.txt', description: 'Unified test summary' },
    { dir: 'tests/reports', file: 'latest-summary.txt', description: 'Legacy summary file' },
    { dir: 'tests/reports', file: 'ci-test-results.json', description: 'CI test results' }
];

// Cache and temporary file patterns
const cachePatterns = [
    { pattern: /^\.DS_Store$/, description: 'macOS metadata files' },
    { pattern: /^Thumbs\.db$/i, description: 'Windows thumbnail cache' },
    { pattern: /^desktop\.ini$/i, description: 'Windows desktop config' },
    { pattern: /.*\.tmp$/i, description: 'Temporary files' },
    { pattern: /.*\.log$/i, description: 'Log files' },
    { pattern: /.*\.pid$/i, description: 'Process ID files' }
];

// Enhanced removal function with better error handling and reporting
function removeSync(targetPath) {
    try {
        const fullPath = path.resolve(targetPath);
        if (!fs.existsSync(fullPath)) {
            return { success: false, reason: 'not_found' };
        }

        const stat = fs.statSync(fullPath);
        const sizeInfo = getSizeInfo(fullPath, stat);

        if (stat.isDirectory()) {
            console.log(`🗑️  Removing directory: ${targetPath} ${sizeInfo}`);
            fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
            console.log(`🗑️  Removing file: ${targetPath} ${sizeInfo}`);
            fs.unlinkSync(fullPath);
        }

        return { success: true, size: sizeInfo };
    } catch (err) {
        console.warn(`⚠️  Could not remove ${targetPath}:`, err.message);
        return { success: false, reason: 'error', error: err.message };
    }
}

// Get human-readable size information
function getSizeInfo(fullPath, stat) {
    if (stat.isDirectory()) {
        try {
            const files = fs.readdirSync(fullPath, { recursive: true });
            return `(${files.length} items)`;
        } catch {
            return '(directory)';
        }
    } else {
        const bytes = stat.size;
        if (bytes === 0) return '(0 bytes)';
        const units = ['bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `(${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]})`;
    }
}

// Clean cache files recursively
function cleanCacheFiles(baseDir = '.') {
    let removedCount = 0;

    function scanDirectory(dir) {
        try {
            const items = fs.readdirSync(dir, { withFileTypes: true });

            for (const item of items) {
                const itemPath = path.join(dir, item.name);

                if (item.isDirectory()) {
                    // Skip node_modules and .git directories
                    if (item.name === 'node_modules' || item.name === '.git') {
                        continue;
                    }
                    scanDirectory(itemPath);
                } else {
                    // Check if file matches cache patterns
                    const matched = cachePatterns.find(p => p.pattern.test(item.name));
                    if (matched) {
                        console.log(`🗑️  Removing ${matched.description}: ${path.relative(process.cwd(), itemPath)}`);
                        try {
                            fs.unlinkSync(itemPath);
                            removedCount++;
                        } catch (err) {
                            console.warn(`⚠️  Could not remove ${itemPath}:`, err.message);
                        }
                    }
                }
            }
        } catch (err) {
            // Silently skip inaccessible directories
        }
    }

    scanDirectory(baseDir);
    return removedCount;
}

// Enhanced test report cleaning with better categorization
function cleanTestReports() {
    let totalRemoved = 0;

    for (const config of testReportPatterns) {
        const dirPath = path.resolve(config.dir);

        if (!fs.existsSync(dirPath)) {
            continue;
        }

        let categoryRemoved = 0;

        if (config.file) {
            // Remove specific file
            const filePath = path.join(dirPath, config.file);
            if (fs.existsSync(filePath)) {
                const stat = fs.statSync(filePath);
                const size = getSizeInfo(filePath, stat);
                console.log(`🗑️  Removing ${config.description}: ${path.relative(process.cwd(), filePath)} ${size}`);
                try {
                    fs.unlinkSync(filePath);
                    categoryRemoved++;
                } catch (err) {
                    console.warn(`⚠️  Could not remove ${filePath}:`, err.message);
                }
            }
        } else if (config.pattern) {
            // Remove files matching pattern
            const files = fs.readdirSync(dirPath);
            const matchingFiles = files.filter(f => config.pattern.test(f));

            if (matchingFiles.length > 0) {
                console.log(`🗑️  Removing ${matchingFiles.length} ${config.description}...`);

                for (const file of matchingFiles) {
                    const filePath = path.join(dirPath, file);
                    try {
                        const stat = fs.statSync(filePath);
                        const size = getSizeInfo(filePath, stat);
                        console.log(`   - ${file} ${size}`);
                        fs.unlinkSync(filePath);
                        categoryRemoved++;
                    } catch (err) {
                        console.warn(`⚠️  Could not remove ${filePath}:`, err.message);
                    }
                }
            }
        }

        totalRemoved += categoryRemoved;
    }

    return totalRemoved;
}

// Parse command line arguments for clean level
function parseCleanLevel() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    if (args.includes('--full') || args.includes('all')) {
        return 'full';
    } else if (args.includes('--light')) {
        return 'light';
    } else {
        return 'standard';
    }
}

// Show help information
function showHelp() {
    console.log(`
🧹 BambiSleep Chat Clean Script v2.0

Usage: npm run clean [level]
   or: node scripts/clean.js [options]

Clean Levels:
  light     Light clean (test reports, temp files)
  standard  Standard clean (+ build artifacts, cache)
  full      Full clean (+ node_modules, dependencies)

Options:
  --light   Same as 'light' level
  --full    Same as 'full' level
  all       Same as 'full' level
  --help    Show this help message

Examples:
  npm run clean              # Standard clean
  npm run clean light        # Light clean only
  npm run clean all          # Full clean including node_modules
  node scripts/clean.js --full

The script automatically detects and cleans:
  ✓ Unified Test Framework v2.0 reports
  ✓ Legacy test reports
  ✓ Build artifacts (Vite, coverage)
  ✓ Cache files (.DS_Store, Thumbs.db, etc.)
  ✓ Temporary files (.tmp, .log, .pid)
  ✓ Node modules (full clean only)
`);
}

// Get clean statistics
function getCleanStats(results) {
    const stats = {
        filesRemoved: 0,
        directoriesRemoved: 0,
        totalSize: '0 bytes',
        errors: 0
    };

    results.forEach(result => {
        if (result.success) {
            if (result.size && result.size.includes('items')) {
                stats.directoriesRemoved++;
            } else {
                stats.filesRemoved++;
            }
        } else {
            stats.errors++;
        }
    });

    return stats;
}

// Main execution
async function main() {
    const startTime = Date.now();
    const cleanLevel = parseCleanLevel();
    const config = CLEAN_LEVELS[cleanLevel];

    console.log('🧹 BambiSleep Chat Clean Script v2.0');
    console.log(`📋 ${config.description}\n`);

    const results = [];
    let totalOperations = 0;

    // Remove main paths based on clean level
    if (config.paths.length > 0) {
        console.log('📁 Removing build artifacts and directories...');
        for (const p of config.paths) {
            const result = removeSync(p);
            results.push(result);
            totalOperations++;
        }
        console.log('');
    }

    // Clean test reports
    if (config.testReports) {
        console.log('📊 Cleaning test reports...');
        const reportCount = cleanTestReports();
        totalOperations += reportCount;
        if (reportCount > 0) {
            console.log(`   ✓ Removed ${reportCount} test report file(s)`);
        } else {
            console.log('   ℹ️ No test reports to clean');
        }
        console.log('');
    }

    // Clean cache files
    if (config.cacheFiles) {
        console.log('🗂️ Cleaning cache and temporary files...');
        const cacheCount = cleanCacheFiles();
        totalOperations += cacheCount;
        if (cacheCount > 0) {
            console.log(`   ✓ Removed ${cacheCount} cache/temp file(s)`);
        } else {
            console.log('   ℹ️ No cache files found');
        }
        console.log('');
    }

    // Dependencies reinstall hint
    if (config.dependencies) {
        console.log('📦 Dependencies removed. To reinstall:');
        console.log('   npm install');
        console.log('');
    }

    // Summary statistics
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const stats = getCleanStats(results);

    console.log('📈 Clean Summary:');
    console.log(`   • Duration: ${duration}s`);
    console.log(`   • Level: ${cleanLevel}`);
    console.log(`   • Total operations: ${totalOperations}`);
    if (stats.filesRemoved > 0) console.log(`   • Files removed: ${stats.filesRemoved}`);
    if (stats.directoriesRemoved > 0) console.log(`   • Directories removed: ${stats.directoriesRemoved}`);
    if (stats.errors > 0) console.log(`   • Errors: ${stats.errors}`);

    console.log('\n✅ Clean complete!');

    // Suggest next steps based on clean level
    if (cleanLevel === 'full') {
        console.log('\n💡 Next steps after full clean:');
        console.log('   npm install          # Reinstall dependencies');
        console.log('   npm run dev          # Start development server');
        console.log('   npm run test         # Verify everything works');
    } else if (cleanLevel === 'standard') {
        console.log('\n💡 Ready for fresh build:');
        console.log('   npm run dev          # Start development server');
        console.log('   npm run test         # Run test suite');
    }
}

// Run the script
if (require.main === module) {
    main().catch(err => {
        console.error('❌ Clean script failed:', err.message);
        process.exit(1);
    });
}
