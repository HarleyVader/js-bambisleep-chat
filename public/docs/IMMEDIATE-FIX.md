# 🔧 IMMEDIATE FIX for BambiSleep Chat SystemD Permission Issue

## 🚨 EMERGENCY FIX (Recommended - Run this first)

```bash
# Navigate to your BambiSleep Chat directory
cd ~/web/bambisleep.chat/js-bambisleep-chat

# Download and run emergency fix script
curl -fsSL https://raw.githubusercontent.com/HarleyVader/js-bambisleep-chat/production/emergency-fix.sh -o emergency-fix.sh
chmod +x emergency-fix.sh
sudo ./emergency-fix.sh
```

## Quick Fix Commands (Alternative method)

```bash
# 1. Navigate to your BambiSleep Chat directory
cd ~/web/bambisleep.chat/js-bambisleep-chat

# 2. Stop the failing service
sudo systemctl stop bambisleepchat

# 3. Run the integrated fix mode
./install.sh fix
```

## Alternative: Manual Fix Steps

If the above doesn't work, run these commands manually:

```bash
# Navigate to directory
cd ~/web/bambisleep.chat/js-bambisleep-chat

# Stop service
sudo systemctl stop bambisleepchat

# Fix permissions
sudo chown -R brandynette:brandynette .
chmod -R 755 .

# Update service with correct paths
node scripts/deploy.js update

# Start service
sudo systemctl start bambisleepchat

# Check status
sudo systemctl status bambisleepchat
```

## Alternative: Download Latest Fix Script

```bash
# Download and run the latest unified script
cd ~/web/bambisleep.chat/js-bambisleep-chat
curl -fsSL https://raw.githubusercontent.com/HarleyVader/js-bambisleep-chat/production/install.sh -o install.sh
chmod +x install.sh
./install.sh fix
```

## Verify Fix

```bash
# Check service status
sudo systemctl is-active bambisleepchat

# Monitor logs
journalctl -u bambisleepchat -f

# Test application
curl http://localhost:7878/api/health
```

The updated deployment script now automatically detects your actual installation directory and user, which should resolve this permission issue permanently.
