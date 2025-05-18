#!/bin/bash
# Verify MongoDB network configuration

echo "Checking MongoDB network access configuration..."

# Check if the container is running
CONTAINER_ID=$(docker ps -q -f name=bambisleep-mongodb)
if [ -z "$CONTAINER_ID" ]; then
  echo "Error: MongoDB container is not running"
  echo "Please start the container using './mongo-docker.sh start'"
  exit 1
fi

# Get the container's IP address
CONTAINER_IP=$(docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $CONTAINER_ID)
echo "Container IP address: $CONTAINER_IP"

# Check the container's network settings
echo "Container network settings:"
docker inspect -f '{{range $key, $value := .NetworkSettings.Networks}}{{$key}}: {{$value.IPAddress}}{{end}}' $CONTAINER_ID

# Check if the container is configured to bind to all IPs
BIND_ALL=$(docker exec $CONTAINER_ID ps aux | grep mongod | grep -c "\-\-bind_ip_all")
if [ $BIND_ALL -eq 0 ]; then
  echo "Warning: MongoDB is not configured to bind to all IPs"
  echo "Make sure the command parameter '--bind_ip_all' is added in docker-compose.yml"
else
  echo "MongoDB is correctly configured to bind to all IPs"
fi

# Check if port 27018 is accessible from outside
PORT_CHECK=$(docker exec $CONTAINER_ID netstat -nltp | grep -c ":27017")
if [ $PORT_CHECK -eq 0 ]; then
  echo "Warning: MongoDB port 27017 is not detected inside the container"
else
  echo "MongoDB port 27017 is correctly configured inside the container (exposed as 27018)"
fi

echo
echo "To connect from 192.168.0.59, use the following connection string:"
echo "mongodb://brandynette:CNNvfZi@192.168.0.178:27018/bambisleep?authSource=admin"
echo
echo "Verification completed"
