/**
 * Test Report Viewer - Opens the latest HTML test report in browser
 * Can also open specific report by timestamp
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const reportsDir = path.join(__dirname, 'reports');

function log(message, emoji = 'ℹ️') {
    console.log(`${emoji} ${message}`);
}

function getLatestHTMLReport() {
    if (!fs.existsSync(reportsDir)) {
        log('Reports directory not found. Run tests first: npm test', '❌');
        return null;
    }

    const files = fs.readdirSync(reportsDir)
        .filter(f => f.endsWith('.html') && f.startsWith('bambisleep-test-report-'))
        .map(f => ({
            name: f,
            path: path.join(reportsDir, f),
            mtime: fs.statSync(path.join(reportsDir, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
        log('No HTML reports found. Run tests first: npm test', '❌');
        return null;
    }

    return files[0];
}

function openInBrowser(filePath) {
    const platform = process.platform;
    let command;

    if (platform === 'win32') {
        // Windows
        command = 'cmd';
        const args = ['/c', 'start', '""', filePath];
        spawn(command, args, { shell: true, detached: true, stdio: 'ignore' });
    } else if (platform === 'darwin') {
        // macOS
        command = 'open';
        spawn(command, [filePath], { detached: true, stdio: 'ignore' });
    } else {
        // Linux
        command = 'xdg-open';
        spawn(command, [filePath], { detached: true, stdio: 'ignore' });
    }

    log(`Opening report in browser...`, '🌐');
}

function showSummary() {
    const summaryPath = path.join(reportsDir, 'latest-summary.txt');

    if (fs.existsSync(summaryPath)) {
        console.log('\n' + '='.repeat(60));
        console.log('📋 LATEST TEST SUMMARY');
        console.log('='.repeat(60) + '\n');

        const summary = fs.readFileSync(summaryPath, 'utf8');
        console.log(summary);

        console.log('='.repeat(60) + '\n');
    }
}

function listAvailableReports() {
    if (!fs.existsSync(reportsDir)) {
        log('Reports directory not found.', '❌');
        return;
    }

    const reports = fs.readdirSync(reportsDir)
        .filter(f => f.endsWith('.html') && f.startsWith('bambisleep-test-report-'))
        .map(f => {
            const stat = fs.statSync(path.join(reportsDir, f));
            return {
                name: f,
                time: stat.mtime.toLocaleString(),
                size: `${(stat.size / 1024).toFixed(1)} KB`
            };
        })
        .sort((a, b) => b.time.localeCompare(a.time));

    if (reports.length === 0) {
        log('No reports found. Run tests first: npm test', '📭');
        return;
    }

    console.log('\n📊 Available Test Reports:\n');
    reports.forEach((report, index) => {
        const marker = index === 0 ? '→ ' : '  ';
        console.log(`${marker}${report.name}`);
        console.log(`   Generated: ${report.time} (${report.size})`);
        console.log();
    });
}

function main() {
    const args = process.argv.slice(2);

    log('BambiSleep Chat - Test Report Viewer', '🧪');
    console.log();

    // Handle commands
    if (args.includes('--list') || args.includes('-l')) {
        listAvailableReports();
        return;
    }

    if (args.includes('--summary') || args.includes('-s')) {
        showSummary();
        return;
    }

    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: npm run test:report [options]');
        console.log('\nOptions:');
        console.log('  (no args)     Open latest HTML report in browser');
        console.log('  --list, -l    List all available reports');
        console.log('  --summary, -s Show latest test summary');
        console.log('  --help, -h    Show this help message');
        console.log('\nExamples:');
        console.log('  npm run test:report           # Open latest report');
        console.log('  npm run test:report -- --list # List all reports');
        console.log('  npm run test:view             # Alias for test:report');
        return;
    }

    // Default: show summary and open latest report
    const latestReport = getLatestHTMLReport();

    if (!latestReport) {
        log('Run tests first to generate reports: npm test', '💡');
        return;
    }

    log(`Latest report: ${latestReport.name}`, '📄');
    log(`Generated: ${latestReport.mtime.toLocaleString()}`, '🕐');

    // Show quick summary
    showSummary();

    // Open in browser
    openInBrowser(latestReport.path);

    log('Report opened in browser!', '✅');
    log(`Path: ${latestReport.path}`, '📁');
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { getLatestHTMLReport, openInBrowser, listAvailableReports };
