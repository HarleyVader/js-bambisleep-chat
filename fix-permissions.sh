#!/bin/bash

# BambiSleep Chat - Quick Fix for Permission Issues
# This script fixes common SystemD service permission problems

set -e

echo "🔧 BambiSleep Chat - Permission Issue Fix"
echo "========================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Get current directory and user
CURRENT_DIR=$(pwd)
CURRENT_USER=$(whoami)

print_info "Current directory: $CURRENT_DIR"
print_info "Current user: $CURRENT_USER"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Not in BambiSleep Chat directory. Please cd to the project root."
    exit 1
fi

if [ ! -f "server.js" ]; then
    print_error "server.js not found. Please ensure you're in the correct directory."
    exit 1
fi

print_status "Found BambiSleep Chat project files"

# Stop the problematic service
print_info "Stopping bambisleepchat service..."
sudo systemctl stop bambisleepchat 2>/dev/null || true

# Fix directory permissions
print_info "Fixing directory permissions..."
sudo chown -R $CURRENT_USER:$CURRENT_USER "$CURRENT_DIR"
chmod -R 755 "$CURRENT_DIR"

print_status "Directory permissions fixed"

# Generate correct service file
print_info "Generating correct SystemD service file..."

cat > bambisleepchat.service << EOF
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
WorkingDirectory=$CURRENT_DIR

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

print_status "Generated new service file with correct paths"

# Install the corrected service
print_info "Installing corrected service..."
sudo cp bambisleepchat.service /etc/systemd/system/
sudo chmod 644 /etc/systemd/system/bambisleepchat.service

# Reload systemd
print_info "Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable and start service
print_info "Enabling and starting service..."
sudo systemctl enable bambisleepchat
sudo systemctl start bambisleepchat

# Wait a moment for startup
sleep 3

# Check status
print_info "Checking service status..."
if sudo systemctl is-active --quiet bambisleepchat; then
    print_status "Service is running successfully!"
    
    # Show status
    echo ""
    echo "📊 Service Status:"
    sudo systemctl status bambisleepchat --no-pager -l
    
    echo ""
    print_status "✅ Fix complete! BambiSleep Chat is now running."
    print_info "📱 Access your application at: http://localhost:7878"
    print_info "📋 Monitor logs with: journalctl -u bambisleepchat -f"
    
else
    print_warning "Service may not be running properly. Checking logs..."
    echo ""
    echo "Recent logs:"
    journalctl -u bambisleepchat -n 10 --no-pager
    
    echo ""
    print_info "Manual start command: sudo systemctl start bambisleepchat"
    print_info "Check logs with: journalctl -u bambisleepchat -f"
fi

echo ""
echo "🔧 Troubleshooting Commands:"
echo "  Status:  sudo systemctl status bambisleepchat"
echo "  Start:   sudo systemctl start bambisleepchat"
echo "  Stop:    sudo systemctl stop bambisleepchat"
echo "  Restart: sudo systemctl restart bambisleepchat"
echo "  Logs:    journalctl -u bambisleepchat -f"
echo ""