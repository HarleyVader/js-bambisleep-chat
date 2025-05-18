# MongoDB Setup for BambiSleep Chat

This guide will help you set up MongoDB for the BambiSleep Chat application.

## Prerequisites

- Linux Ubuntu server
- Basic terminal/command line knowledge
- SSH access to your server

## 1. Install MongoDB

```bash
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Create list file for MongoDB
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Update package index
sudo apt-get update

# Install MongoDB packages
sudo apt-get install -y mongodb-org
```

## 2. Start and Enable MongoDB Service

```bash
# Start MongoDB
sudo systemctl start mongod

# Check status to make sure it's running
sudo systemctl status mongod

# Enable MongoDB to start automatically on system boot
sudo systemctl enable mongod
```

## 3. Verify Installation

```bash
# Check MongoDB version
mongod --version

# Connect to MongoDB shell
mongosh
```

Inside the MongoDB shell, you can test with:

```
> db.runCommand({ping: 1})
```

If successful, it should return `{ ok: 1 }`.

## 4. Create Database and User

Connect to MongoDB shell:

```bash
mongosh
```

Create a database for BambiSleep Chat:

```
> use bambisleep
```

Create a user with proper permissions:

```
> db.createUser({
    user: "bambiuser",
    pwd: "strong-password-here",
    roles: [{ role: "readWrite", db: "bambisleep" }]
  })
```

Remember to replace "strong-password-here" with a secure password.

## 5. Configure MongoDB for Remote Access (Optional)

If you need remote access to MongoDB:

1. Edit the MongoDB configuration:

```bash
sudo nano /etc/mongod.conf
```

2. Modify the `bindIp` setting to allow connections from anywhere:

```yaml
net:
  port: 27017
  bindIp: 0.0.0.0  # CAUTION: This allows connections from anywhere
```

3. Restart MongoDB:

```bash
sudo systemctl restart mongod
```

**IMPORTANT**: When allowing remote access, you MUST set up authentication and firewall rules to protect your database.

## 6. Configure Application

Create or edit the `.env` file in your application root:

```
# For local development with no auth
MONGODB_URI=mongodb://localhost:27017/bambisleep

# For production with authentication
MONGODB_URI=mongodb://bambiuser:your-password-here@localhost:27017/bambisleep

# Optional - Fallback connection if main fails
MONGODB_FALLBACK_URI=mongodb://localhost:27017/bambisleep
```

## 7. Test MongoDB Connection

Run the built-in test scripts:

```bash
# Check MongoDB installation
npm run check:mongo-install

# Verify MongoDB connection
npm run check:mongodb

# Validate MongoDB configuration
npm run check:config

# Run full test suite
npm run test:mongodb
```

## Troubleshooting

### MongoDB won't start

Check logs for errors:
```bash
sudo journalctl -u mongod.service
```

### Connection issues in the application

Run the test script to diagnose:
```bash
npm run check:mongodb
```

### Insufficient permissions

Make sure MongoDB data directory has proper permissions:
```bash
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chmod -R 755 /var/lib/mongodb
```

## Additional Resources

- [Official MongoDB Documentation](https://www.mongodb.com/docs/)
- [MongoDB University - Free Courses](https://university.mongodb.com/)
