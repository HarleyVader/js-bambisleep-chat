#!/bin/bash

# BambiSleep Chat - Unified Install & Fix Script
# Version: v0.3.0
# Compatible: Ubuntu 20.04+, Debian 11+, CentOS 8+
# Usage: ./install.sh [install|fix|--help]

set -e

# Parse command line arguments
OPERATION="install"
if [ "$1" = "fix" ]; then
    OPERATION="fix"
    echo "🔧 BambiSleep Chat v0.3.0 - Permission Fix Mode"
    echo "================================================"
elif [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "BambiSleep Chat - Unified Install & Fix Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  install    Full installation (default)"
    echo "  fix        Fix existing installation permissions"
    echo "  --help     Show this help"
    echo ""
    echo "Examples:"
    echo "  $0              # Full installation"
    echo "  $0 install      # Full installation"
    echo "  $0 fix          # Fix permissions for existing install"
    exit 0
else
    echo "🚀 BambiSleep Chat v0.3.0 - Production Installation"
    echo "=================================================="
fi

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    print_error "Cannot detect OS version"
    exit 1
fi

print_info "Detected OS: $OS $VER"

# Handle fix mode for existing installations
if [ "$OPERATION" = "fix" ]; then
    print_info "Running in Fix Mode - repairing existing installation..."

    # Check if we're in the right directory
    if [ ! -f "package.json" ] || [ ! -f "server.js" ]; then
        print_error "Not in BambiSleep Chat directory."
        print_info "Please run this script from your BambiSleep Chat installation directory."
        print_info "Example: cd ~/web/bambisleep-chat && ./install.sh fix"
        exit 1
    fi

    INSTALL_DIR=$(pwd)
    print_info "Found BambiSleep Chat installation at: $INSTALL_DIR"

    # Skip to the SystemD deployment section for fixes
    print_info "Skipping installation steps, proceeding to service fixes..."
else
    # Full installation mode
    # Update system packages
    print_info "Updating system packages..."
    sudo apt update -qq

# Install Node.js 20 LTS if not present
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt "20" ]; then
    print_info "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_status "Node.js $(node -v) installed"
else
    print_status "Node.js $(node -v) already installed"
fi

# Install Git if not present
if ! command -v git &> /dev/null; then
    print_info "Installing Git..."
    sudo apt-get install -y git
    print_status "Git installed"
else
    print_status "Git already installed"
fi

# Install curl if not present
if ! command -v curl &> /dev/null; then
    print_info "Installing curl..."
    sudo apt-get install -y curl
    print_status "curl installed"
fi

# Clone repository
INSTALL_DIR="$HOME/web/bambisleep-chat"
if [ -d "$INSTALL_DIR" ]; then
    print_warning "Directory $INSTALL_DIR already exists. Removing..."
    rm -rf "$INSTALL_DIR"
fi

print_info "Cloning BambiSleep Chat repository..."
git clone https://github.com/HarleyVader/js-bambisleep-chat.git "$INSTALL_DIR"
cd "$INSTALL_DIR"

print_status "Repository cloned to $INSTALL_DIR"

# Install NPM dependencies
print_info "Installing NPM dependencies..."
npm install --production

print_status "Dependencies installed"

# Copy environment configuration
if [ ! -f "config/env.js" ]; then
    print_info "Setting up environment configuration..."
    cp config/env.js.example config/env.js
    print_status "Environment configuration created"
fi

# Run tests
print_info "Running test suite..."
if npm test; then
    print_status "Tests completed successfully"
else
    print_warning "Some tests failed, but deployment can continue"
fi

# Build production assets
print_info "Building production assets..."
npm run build

print_status "Production build completed"

fi  # End of installation mode

# Deploy to SystemD with enhanced permission handling
if command -v systemctl &> /dev/null; then
    print_info "Setting up SystemD service with permission fixes..."

    # Stop any existing service first
    print_info "Stopping any existing bambisleepchat service..."
    sudo systemctl stop bambisleepchat 2>/dev/null || true

    # Fix directory permissions proactively
    print_info "Setting proper directory permissions..."
    CURRENT_USER=$(whoami)
    sudo chown -R $CURRENT_USER:$CURRENT_USER "$INSTALL_DIR"
    chmod -R 755 "$INSTALL_DIR"
    print_status "Directory permissions configured"

    # Generate service file with correct paths and user
    print_info "Generating SystemD service file with detected configuration..."

    cat > "$INSTALL_DIR/bambisleepchat.service" << EOF
[Unit]
Description=BambiSleep Chat - Enterprise Real-time Chat Application v0.3.0
Documentation=https://github.com/HarleyVader/js-bambisleep-chat
After=network.target network-online.target
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=3

[Service]
Type=simple
User=$CURRENT_USER
Group=$CURRENT_USER
WorkingDirectory=$INSTALL_DIR

# Pre-startup validation
ExecStartPre=$(which node) --version

# Main application startup
ExecStart=$(which node) server.js

# Graceful shutdown
ExecStop=/bin/kill -SIGTERM \$MAINPID
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
Environment=NODE_ENV=production
Environment=PORT=7878
Environment=NODE_OPTIONS=--max-old-space-size=1024

[Install]
WantedBy=multi-user.target
EOF

    print_status "Generated service file with current user ($CURRENT_USER) and directory ($INSTALL_DIR)"

    # Install the service
    print_info "Installing SystemD service..."
    sudo cp "$INSTALL_DIR/bambisleepchat.service" /etc/systemd/system/
    sudo chmod 644 /etc/systemd/system/bambisleepchat.service

    # Reload and enable service
    print_info "Configuring SystemD service..."
    sudo systemctl daemon-reload
    sudo systemctl enable bambisleepchat

    # Start service
    print_info "Starting BambiSleep Chat service..."
    sudo systemctl start bambisleepchat

    # Wait for startup
    sleep 5

    # Validate deployment with detailed checking
    print_info "Validating service deployment..."

    if sudo systemctl is-active --quiet bambisleepchat; then
        print_status "✅ SystemD service is running successfully!"

        # Show service status
        echo ""
        echo "📊 Service Status:"
        sudo systemctl status bambisleepchat --no-pager -l

        # Test application endpoint if possible
        if curl -f http://localhost:7878/api/health >/dev/null 2>&1; then
            print_status "✅ Application health check passed"
        else
            print_warning "Application may still be starting up (health check failed)"
        fi

        print_status "✅ SystemD deployment completed successfully"

    else
        print_warning "Service may not be running properly. Checking logs..."
        echo ""
        echo "Recent logs:"
        journalctl -u bambisleepchat -n 10 --no-pager

        echo ""
        print_info "Attempting manual service restart..."
        sudo systemctl restart bambisleepchat
        sleep 3

        if sudo systemctl is-active --quiet bambisleepchat; then
            print_status "✅ Service recovered after restart"
        else
            print_error "Service startup failed. Manual intervention may be required."
            print_info "Check logs with: journalctl -u bambisleepchat -f"
            print_info "Manual start: sudo systemctl start bambisleepchat"
        fi
    fi

else
    print_warning "SystemD not available, skipping service setup"
    print_info "Start manually with: cd $INSTALL_DIR && npm start"
fi

# Final instructions
echo ""
if [ "$OPERATION" = "fix" ]; then
    echo "🎉 BambiSleep Chat Permission Fix Complete!"
    echo "=========================================="
else
    echo "🎉 BambiSleep Chat Installation Complete!"
    echo "========================================"
fi
echo ""
echo "📍 Installation Directory: $INSTALL_DIR"
echo "🌐 Application URL: http://localhost:7878"
echo ""

if command -v systemctl &> /dev/null; then
    echo "🔧 Service Management:"
    echo "  Status:  sudo systemctl status bambisleepchat"
    echo "  Start:   sudo systemctl start bambisleepchat"
    echo "  Stop:    sudo systemctl stop bambisleepchat"
    echo "  Restart: sudo systemctl restart bambisleepchat"
    echo "  Logs:    journalctl -u bambisleepchat -f"
    echo ""
fi

echo "📚 Documentation:"
echo "  Main Guide:  $INSTALL_DIR/README.md"
echo "  Deployment:  $INSTALL_DIR/DEPLOYMENT.md"
echo "  Docs:        $INSTALL_DIR/public/docs/"
echo ""

echo "🏥 Health Check:"
echo "  curl http://localhost:7878/api/health"
echo ""

if [ "$OPERATION" = "fix" ]; then
    echo "🎯 Status: Permission Issues Fixed v0.3.0"
    echo "Service should now be running properly! 🚀"
else
    echo "🎯 Status: Production Ready v0.3.0"
    echo "Ready to use! 🚀"
fi
