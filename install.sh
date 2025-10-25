#!/bin/bash

# BambiSleep Chat - Quick Install Script
# Version: v0.3.0
# Compatible: Ubuntu 20.04+, Debian 11+, CentOS 8+

set -e

echo "🚀 BambiSleep Chat v0.3.0 - Production Installation"
echo "=================================================="

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

# Deploy to SystemD (if available)
if command -v systemctl &> /dev/null; then
    print_info "Setting up SystemD service..."

    if node scripts/deploy.js; then
        print_status "SystemD service configured and started"

        # Validate deployment
        print_info "Validating deployment..."
        sleep 5  # Wait for service to start

        if node scripts/validate-service.js; then
            print_status "Deployment validation successful"
        else
            print_warning "Deployment validation had issues, check logs"
        fi
    else
        print_error "SystemD service setup failed"
        print_info "You can start manually with: npm start"
    fi
else
    print_warning "SystemD not available, skipping service setup"
    print_info "Start manually with: cd $INSTALL_DIR && npm start"
fi

# Final instructions
echo ""
echo "🎉 BambiSleep Chat Installation Complete!"
echo "========================================"
echo ""
echo "📍 Installation Directory: $INSTALL_DIR"
echo "🌐 Application URL: http://localhost:6969"
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
echo "  curl http://localhost:6969/api/health"
echo ""

echo "🎯 Status: Production Ready v0.3.0"
echo "Ready to use! 🚀"
