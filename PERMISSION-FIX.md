# Quick Fix for BambiSleep Chat SystemD Permission Issue

The error `Failed at step CHDIR spawning /usr/bin/test: Permission denied` indicates that the SystemD service cannot access the working directory.

## Immediate Fix (Run on your Linux server)

```bash
# Navigate to your BambiSleep Chat directory
cd ~/web/bambisleep.chat/js-bambisleep-chat

# Stop the problematic service
sudo systemctl stop bambisleepchat

# Fix permissions
sudo chown -R brandynette:brandynette .
chmod -R 755 .

# Regenerate the service file with correct paths
node scripts/deploy.js update

# Start the service
sudo systemctl start bambisleepchat

# Check status
sudo systemctl status bambisleepchat
```

## Alternative: Use the automated fix script

```bash
# Download and run the fix script
curl -fsSL https://raw.githubusercontent.com/HarleyVader/js-bambisleep-chat/production/fix-permissions.sh -o fix-permissions.sh
chmod +x fix-permissions.sh
./fix-permissions.sh
```

## Quick Status Check

```bash
# Check if service is running
sudo systemctl is-active bambisleepchat

# View logs
journalctl -u bambisleepchat -f
```

The updated deployment script now automatically detects the correct user and working directory to prevent this issue in future deployments.