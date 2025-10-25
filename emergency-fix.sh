#!/bin/bash

# BambiSleep Chat - Emergency SystemD Fix Script
# This script completely replaces the problematic service configuration

set -e

echo "🚨 BambiSleep Chat - Emergency SystemD Fix"
echo "=========================================="

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

# Check if we're in the right directory
CURRENT_DIR=$(pwd)
CURRENT_USER=$(whoami)

print_info "Emergency fix running in: $CURRENT_DIR"
print_info "Current user: $CURRENT_USER"

if [ ! -f "package.json" ] || [ ! -f "server.js" ]; then
    print_error "Not in BambiSleep Chat directory."
    print_info "Please run this from: ~/web/bambisleep.chat/js-bambisleep-chat"
    exit 1
fi

print_status "Found BambiSleep Chat installation"

# Stop and disable the problematic service completely
print_info "Stopping and removing problematic service..."
sudo systemctl stop bambisleepchat 2>/dev/null || true
sudo systemctl disable bambisleepchat 2>/dev/null || true
sudo rm -f /etc/systemd/system/bambisleepchat.service

print_status "Removed old service configuration"

# Fix directory permissions thoroughly
print_info "Fixing all directory permissions..."
sudo chown -R $CURRENT_USER:$CURRENT_USER "$CURRENT_DIR"
find "$CURRENT_DIR" -type d -exec chmod 755 {} \;
find "$CURRENT_DIR" -type f -exec chmod 644 {} \;
chmod +x "$CURRENT_DIR/install.sh" 2>/dev/null || true
chmod +x "$CURRENT_DIR/scripts/"*.js 2>/dev/null || true

print_status "Directory permissions fixed"

# Create a completely new, clean service file
print_info "Creating clean SystemD service file..."

NODE_PATH=$(which node)
print_info "Using Node.js at: $NODE_PATH"

cat > bambisleepchat.service << EOF
[Unit]
Description=BambiSleep Chat - Real-time Chat Application
Documentation=https://github.com/HarleyVader/js-bambisleep-chat
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$CURRENT_USER
Group=$CURRENT_USER
WorkingDirectory=$CURRENT_DIR
ExecStart=$NODE_PATH server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=7878
StandardOutput=journal
StandardError=journal
SyslogIdentifier=bambisleep-chat

[Install]
WantedBy=multi-user.target
EOF

print_status "Created clean service file"

# Install the new service
print_info "Installing new service..."
sudo cp bambisleepchat.service /etc/systemd/system/
sudo chmod 644 /etc/systemd/system/bambisleepchat.service

# Reload systemd completely
print_info "Reloading SystemD..."
sudo systemctl daemon-reload

# Enable and start the service
print_info "Enabling and starting service..."
sudo systemctl enable bambisleepchat
sudo systemctl start bambisleepchat

# Wait for startup
print_info "Waiting for service to start..."
sleep 5

# Check status
if sudo systemctl is-active --quiet bambisleepchat; then
    print_status "🎉 SUCCESS! Service is now running properly!"

    echo ""
    echo "📊 Service Status:"
    sudo systemctl status bambisleepchat --no-pager -l

    echo ""
    print_info "Testing application..."
    if curl -f http://localhost:6969/api/health >/dev/null 2>&1; then
        print_status "✅ Application is responding on port 6969"
    else
        print_warning "Application may still be starting up"
    fi

else
    print_error "Service failed to start. Checking logs..."
    echo ""
    echo "Recent logs:"
    journalctl -u bambisleepchat -n 20 --no-pager
fi

echo ""
echo "🔧 Service Management Commands:"
echo "  Status:  sudo systemctl status bambisleepchat"
echo "  Stop:    sudo systemctl stop bambisleepchat"
echo "  Start:   sudo systemctl start bambisleepchat"
echo "  Restart: sudo systemctl restart bambisleepchat"
echo "  Logs:    journalctl -u bambisleepchat -f"
echo ""

if sudo systemctl is-active --quiet bambisleepchat; then
    print_status "🚀 BambiSleep Chat is now running at http://localhost:6969"
else
    print_error "Manual intervention may be required"
fi
