#!/bin/bash

# MongoDB Installation Checker Script
# Verifies mongod server and mongosh shell availability

echo "===== MongoDB Installation Check ====="
echo "Checking MongoDB server and tools availability..."

# Check if mongod is installed
echo -n "Checking mongod: "
if command -v mongod &> /dev/null; then
    MONGOD_VERSION=$(mongod --version | head -n 1)
    echo "✅ Found - $MONGOD_VERSION"
else
    echo "❌ Not found - MongoDB server (mongod) is not installed or not in PATH"
fi

# Check if mongosh is installed
echo -n "Checking mongosh: "
if command -v mongosh &> /dev/null; then
    MONGOSH_VERSION=$(mongosh --version)
    echo "✅ Found - $MONGOSH_VERSION"
else
    echo "❌ Not found - MongoDB shell (mongosh) is not installed or not in PATH"
fi

# Check if mongod service is running
echo -n "Checking MongoDB service: "
if pgrep -x "mongod" &> /dev/null; then
    echo "✅ Running"
    
    # Try to get more details about the running mongod
    echo "MongoDB server details:"
    ps aux | grep mongod | grep -v grep | awk '{print "  PID: " $2 ", Started: " $9 " " $10}'
    
    # Check if we can connect to mongod
    echo -n "Testing connection: "
    if echo "db.runCommand({ping:1})" | mongosh --quiet &> /dev/null; then
        echo "✅ Success"
    else
        echo "❌ Failed to connect"
    fi
else
    echo "❌ Not running"
fi

# Check MongoDB data directory
echo -n "Checking data directory: "
DEFAULT_DBPATH="/var/lib/mongodb"
if [ -d "$DEFAULT_DBPATH" ]; then
    echo "✅ Found at $DEFAULT_DBPATH"
    
    # Check permissions
    echo -n "Checking permissions: "
    if [ -r "$DEFAULT_DBPATH" ] && [ -w "$DEFAULT_DBPATH" ]; then
        echo "✅ Read/Write access OK"
    else
        echo "❌ Permissions issue with $DEFAULT_DBPATH"
    fi
else
    echo "❌ Default directory not found"
    
    # Try to find where the data directory might be
    echo "Searching for possible MongoDB data directories..."
    POSSIBLE_DIRS=$(find /var /opt /data -name "mongodb" -type d 2>/dev/null | head -5)
    
    if [ -n "$POSSIBLE_DIRS" ]; then
        echo "Possible MongoDB data directories:"
        echo "$POSSIBLE_DIRS" | while read dir; do
            echo "  $dir"
        done
    fi
fi

# Check MongoDB config file
echo -n "Checking MongoDB config file: "
DEFAULT_CONFIG="/etc/mongod.conf"
if [ -f "$DEFAULT_CONFIG" ]; then
    echo "✅ Found at $DEFAULT_CONFIG"
else
    echo "❌ Default config not found"
    
    # Try to find where the config file might be
    echo "Searching for possible MongoDB config files..."
    find / -name "mongod*.conf" 2>/dev/null | head -3 | while read file; do
        echo "  $file"
    done
fi

echo "===== MongoDB Environment Check ====="
# Check environment variables
echo -n "Checking MONGODB_URI environment variable: "
if [ -n "$MONGODB_URI" ]; then
    # Mask password in output
    MASKED_URI=$(echo $MONGODB_URI | sed -E 's/\/\/([^:]+):([^@]+)@/\/\/\1:****@/')
    echo "✅ Set to $MASKED_URI"
else
    echo "❌ Not set"
fi

echo "===== MongoDB Installation Summary ====="
# Basic summary and next steps
if command -v mongod &> /dev/null && pgrep -x "mongod" &> /dev/null; then
    echo "✅ MongoDB appears to be properly installed and running"
    echo "  You can proceed with your application configuration"
else
    echo "❌ MongoDB installation has issues that need to be addressed:"
    
    if ! command -v mongod &> /dev/null; then
        echo "  - Install MongoDB server (mongod)"
        echo "    Ubuntu: sudo apt install mongodb-org"
        echo "    Other distros: https://www.mongodb.com/docs/manual/installation/"
    fi
    
    if ! pgrep -x "mongod" &> /dev/null; then
        echo "  - Start MongoDB service:"
        echo "    sudo systemctl start mongod"
        echo "    sudo systemctl enable mongod  # For auto-start at boot"
    fi
    
    if ! command -v mongosh &> /dev/null; then
        echo "  - Install MongoDB shell (mongosh):"
        echo "    Ubuntu: sudo apt install mongodb-mongosh"
        echo "    Other methods: https://www.mongodb.com/docs/mongodb-shell/install/"
    fi
fi

echo "===== End of MongoDB Check ====="
