# MongoDB Docker Configuration

This document explains how to use the MongoDB Docker container with your BambiSleep Chat application.

## Container Details

- MongoDB is running in a Docker container
- External Port: 27018
- Internal Port: 27017
- Username: brandynette
- Password: CNNvfZi
- Databases: bambisleep, bambisleep-profiles

## Connection Strings

Update your `.env` file with the following connection strings:

```
MONGODB_URI=mongodb://brandynette:CNNvfZi@192.168.0.178:27018/bambisleep?authSource=admin
MONGODB_PROFILES=mongodb://brandynette:CNNvfZi@192.168.0.178:27018/bambisleep-profiles?authSource=admin
```

## Managing the Container

### Using PowerShell (Windows)

```powershell
# Start the container
./mongo-docker.ps1 start

# Stop the container
./mongo-docker.ps1 stop

# Restart the container
./mongo-docker.ps1 restart

# Check container status
./mongo-docker.ps1 status

# View container logs
./mongo-docker.ps1 logs
```

### Using Bash (Linux)

```bash
# Start the container
./mongo-docker.sh start

# Stop the container
./mongo-docker.sh stop

# Restart the container
./mongo-docker.sh restart

# Check container status
./mongo-docker.sh status

# View container logs
./mongo-docker.sh logs
```

## Testing the Connection

### Using PowerShell (Windows)

```powershell
./test-mongodb-connection.ps1
```

### Using Bash (Linux)

```bash
./test-mongodb-connection.sh
```

## Accessing from IP 192.168.0.59

The MongoDB container is configured to be accessible from any IP in the 192.168.0.0/24 subnet, including 192.168.0.59. 
Use the following connection string from that IP:

```
mongodb://brandynette:CNNvfZi@192.168.0.178:27018/bambisleep?authSource=admin
```
