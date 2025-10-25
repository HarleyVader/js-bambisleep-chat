#!/usr/bin/env node
// Clean script - removes build artifacts and test reports

const fs = require('fs');
const path = require('path');

const pathsToRemove = [
    'node_modules',
    'public/dist',
    'package-lock.json'
];

const testReportPatterns = [
    { dir: 'tests/reports', pattern: /^bambisleep-.*\.html$/ },
    { dir: 'tests/reports', pattern: /^bambisleep-.*\.json$/ },
    { dir: 'tests/reports', file: 'latest-summary.txt' }
];

function removeSync(targetPath) {
    try {
        const fullPath = path.resolve(targetPath);
        if (!fs.existsSync(fullPath)) {
            return;
        }

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            console.log(`🗑️  Removing directory: ${targetPath}`);
            fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
            console.log(`🗑️  Removing file: ${targetPath}`);
            fs.unlinkSync(fullPath);
        }
    } catch (err) {
        console.warn(`⚠️  Could not remove ${targetPath}:`, err.message);
    }
}

function cleanTestReports() {
    for (const config of testReportPatterns) {
        const dirPath = path.resolve(config.dir);

        if (!fs.existsSync(dirPath)) {
            continue;
        }

        if (config.file) {
            // Remove specific file
            const filePath = path.join(dirPath, config.file);
            if (fs.existsSync(filePath)) {
                console.log(`🗑️  Removing test file: ${path.relative(process.cwd(), filePath)}`);
                fs.unlinkSync(filePath);
            }
        } else if (config.pattern) {
            // Remove files matching pattern
            const files = fs.readdirSync(dirPath);
            const matchingFiles = files.filter(f => config.pattern.test(f));

            for (const file of matchingFiles) {
                const filePath = path.join(dirPath, file);
                console.log(`🗑️  Removing test report: ${path.relative(process.cwd(), filePath)}`);
                fs.unlinkSync(filePath);
            }
        }
    }
}

console.log('🧹 Starting clean...\n');

// Remove main paths
for (const p of pathsToRemove) {
    removeSync(p);
}

// Clean test reports
console.log('\n📊 Cleaning test reports...');
cleanTestReports();

console.log('\n✅ Clean complete!');
