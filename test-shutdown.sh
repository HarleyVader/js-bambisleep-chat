#!/bin/bash
# A simple script to test the shutdown process

echo "Starting server with test script..."
node src/server.js &
SERVER_PID=$!

echo "Server started with PID: $SERVER_PID"
echo "Waiting 5 seconds before sending shutdown signal..."
sleep 5

echo "Sending SIGINT to server..."
kill -2 $SERVER_PID

echo "Waiting for server to shutdown (max 5 seconds)..."
timeout=5
count=0
while kill -0 $SERVER_PID 2>/dev/null; do
  sleep 1
  count=$((count+1))
  if [ $count -ge $timeout ]; then
    echo "Server did not shutdown within $timeout seconds!"
    echo "Forcing termination..."
    kill -9 $SERVER_PID
    exit 1
  fi
done

echo "Server shutdown successfully within $count seconds."
