#!/usr/bin/env node
/**
 * BambiSleep Chat Production Deployment Script
 * Handles systemd service installation and management
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVICE_FILE = 'bambisleepchat.service';
const SERVICE_PATH = `/etc/systemd/system/${SERVICE_FILE}`;

// Dynamic deployment configuration
function getDeploymentConfig() {
    const currentDir = process.cwd();
    const currentUser = process.env.USER || process.env.USERNAME || 'bambisleep';

    return {
        serviceName: 'bambisleepchat',
        user: currentUser,
        group: currentUser,
        workingDirectory: currentDir,
        port: process.env.PORT || 7878,
        environment: 'production',
        nodeCommand: process.execPath // Use the same Node.js executable that's running this script
    };
}

const DEPLOYMENT_CONFIG = getDeploymentConfig();

function showHelp() {
    console.log(`
🚀 BambiSleep Chat Production Deployment Script

Usage: node scripts/deploy.js [command]

Commands:
  install      Install systemd service and start application
  update       Update service configuration and restart
  start        Start the service
  stop         Stop the service
  restart      Restart the service
  status       Show service status
  logs         Show recent logs
  uninstall    Remove systemd service
  validate     Validate deployment configuration
  help         Show this help message

Examples:
  node scripts/deploy.js install    # Fresh installation
  node scripts/deploy.js update     # Update existing service
  node scripts/deploy.js logs       # Monitor logs

Prerequisites:
  • Linux system with systemd
  • sudo privileges for systemd operations
  • Node.js >= 20.0.0 installed (LTS recommended)
  • npm >= 10.0.0 or compatible package manager
  • All dependencies installed (npm ci)
`);
}

function runCommand(command, description) {
    try {
        console.log(`🔄 ${description}...`);
        const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
        console.log(`✅ ${description} completed`);
        return output;
    } catch (error) {
        console.error(`❌ ${description} failed:`, error.message);
        if (error.stdout) console.log('stdout:', error.stdout);
        if (error.stderr) console.log('stderr:', error.stderr);
        throw error;
    }
}

function validateEnvironment() {
    console.log('🔍 Validating deployment environment...');

    // Check if we're on Linux with systemd
    try {
        runCommand('which systemctl', 'Checking systemctl availability');
    } catch {
        throw new Error('systemd not available - this script requires a Linux system with systemd');
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const requiredMajor = 20;
    const currentMajor = parseInt(nodeVersion.slice(1).split('.')[0]);

    console.log(`📋 Node.js version: ${nodeVersion}`);

    if (currentMajor < requiredMajor) {
        throw new Error(`Node.js >= ${requiredMajor}.0.0 required, found ${nodeVersion}`);
    }

    console.log('✅ Node.js version meets requirements');

    // Validate package.json
    if (!fs.existsSync('package.json')) {
        throw new Error('package.json not found');
    }

    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    console.log(`📦 Application: ${packageJson.name} v${packageJson.version}`);

    // Check main server file
    if (!fs.existsSync('src/server/server.js')) {
        throw new Error('src/server/server.js not found');
    }

    console.log('✅ Environment validation passed');
}

function generateServiceFile() {
    const config = DEPLOYMENT_CONFIG;

    console.log('📄 Generating SystemD service file...');
    console.log(`   Working Directory: ${config.workingDirectory}`);
    console.log(`   User: ${config.user}`);
    console.log(`   Port: ${config.port}`);

    const serviceContent = `[Unit]
Description=BambiSleep Chat - Enterprise Real-time Chat Application v0.3.0
Documentation=https://github.com/HarleyVader/js-bambisleep-chat
After=network.target network-online.target
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=3

[Service]
Type=simple
User=${config.user}
Group=${config.group}
WorkingDirectory=${config.workingDirectory}

# Pre-startup validation
ExecStartPre=${config.nodeCommand} --version

# Main application startup
ExecStart=${config.nodeCommand} src/server/server.js

# Graceful shutdown
ExecStop=/bin/kill -SIGTERM $MAINPID
TimeoutStopSec=30
KillMode=mixed
KillSignal=SIGTERM

# Restart configuration
Restart=always
RestartSec=10
RestartPreventExitStatus=0

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=bambisleep-chat

# Environment
Environment=NODE_ENV=${config.environment}
Environment=PORT=${config.port}
Environment=NODE_OPTIONS=--max-old-space-size=1024

[Install]
WantedBy=multi-user.target
`;

    fs.writeFileSync(SERVICE_FILE, serviceContent);
    console.log(`✅ Generated service file: ${SERVICE_FILE}`);
}

function installService() {
    console.log('🚀 Installing BambiSleep Chat service...');

    validateEnvironment();

    // Generate service file with current configuration
    generateServiceFile();

    // Copy service file to systemd directory
    runCommand(`sudo cp ${SERVICE_FILE} ${SERVICE_PATH}`, 'Copying service file');

    // Set proper permissions
    runCommand(`sudo chmod 644 ${SERVICE_PATH}`, 'Setting service file permissions');

    // Reload systemd
    runCommand('sudo systemctl daemon-reload', 'Reloading systemd daemon');

    // Enable service
    runCommand(`sudo systemctl enable ${DEPLOYMENT_CONFIG.serviceName}`, 'Enabling service');

    // Start service
    runCommand(`sudo systemctl start ${DEPLOYMENT_CONFIG.serviceName}`, 'Starting service');

    // Check status
    const status = runCommand(`sudo systemctl is-active ${DEPLOYMENT_CONFIG.serviceName}`, 'Checking service status');

    if (status.trim() === 'active') {
        console.log('🎉 Service installed and started successfully!');
        console.log(`📊 Access your application at: http://localhost:${DEPLOYMENT_CONFIG.port}`);
        console.log(`📋 Monitor logs with: journalctl -u ${DEPLOYMENT_CONFIG.serviceName} -f`);
    } else {
        console.warn('⚠️ Service may not be running properly. Check logs.');
    }
}

function updateService() {
    console.log('🔄 Updating BambiSleep Chat service...');

    validateEnvironment();

    // Generate updated service file
    generateServiceFile();

    // Stop service
    try {
        runCommand(`sudo systemctl stop ${DEPLOYMENT_CONFIG.serviceName}`, 'Stopping service');
    } catch {
        console.log('ℹ️ Service was not running');
    }

    // Update service file
    runCommand(`sudo cp ${SERVICE_FILE} ${SERVICE_PATH}`, 'Updating service file');

    // Reload and restart
    runCommand('sudo systemctl daemon-reload', 'Reloading systemd daemon');
    runCommand(`sudo systemctl start ${DEPLOYMENT_CONFIG.serviceName}`, 'Starting service');

    console.log('✅ Service updated successfully!');
}

function showStatus() {
    try {
        console.log('📊 BambiSleep Chat Service Status:');
        runCommand(`sudo systemctl status ${DEPLOYMENT_CONFIG.serviceName} --no-pager`, 'Getting service status');
    } catch (error) {
        console.log('❌ Service status check failed - service may not be installed');
    }
}

function showLogs() {
    try {
        console.log('📋 Recent BambiSleep Chat Logs:');
        runCommand(`sudo journalctl -u ${DEPLOYMENT_CONFIG.serviceName} --no-pager -n 50`, 'Getting recent logs');
        console.log('\n💡 For live logs, run: sudo journalctl -u bambisleepchat -f');
    } catch (error) {
        console.log('❌ Could not retrieve logs - service may not be installed');
    }
}

function uninstallService() {
    console.log('🗑️ Uninstalling BambiSleep Chat service...');

    try {
        runCommand(`sudo systemctl stop ${DEPLOYMENT_CONFIG.serviceName}`, 'Stopping service');
        runCommand(`sudo systemctl disable ${DEPLOYMENT_CONFIG.serviceName}`, 'Disabling service');
        runCommand(`sudo rm -f ${SERVICE_PATH}`, 'Removing service file');
        runCommand('sudo systemctl daemon-reload', 'Reloading systemd daemon');
        console.log('✅ Service uninstalled successfully');
    } catch (error) {
        console.log('⚠️ Some uninstall steps failed, but service should be removed');
    }
}

// Main execution
function main() {
    const command = process.argv[2];

    try {
        switch (command) {
            case 'install':
                installService();
                break;
            case 'update':
                updateService();
                break;
            case 'start':
                runCommand(`sudo systemctl start ${DEPLOYMENT_CONFIG.serviceName}`, 'Starting service');
                break;
            case 'stop':
                runCommand(`sudo systemctl stop ${DEPLOYMENT_CONFIG.serviceName}`, 'Stopping service');
                break;
            case 'restart':
                runCommand(`sudo systemctl restart ${DEPLOYMENT_CONFIG.serviceName}`, 'Restarting service');
                break;
            case 'status':
                showStatus();
                break;
            case 'logs':
                showLogs();
                break;
            case 'uninstall':
                uninstallService();
                break;
            case 'validate':
                validateEnvironment();
                console.log('✅ All validation checks passed!');
                break;
            case 'help':
            case '--help':
            case '-h':
            default:
                showHelp();
                break;
        }
    } catch (error) {
        console.error('💥 Deployment failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
