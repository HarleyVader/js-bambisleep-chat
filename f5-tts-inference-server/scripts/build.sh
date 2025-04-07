#!/bin/bash

# Build the Docker image for the F5-TTS inference server
# Ensure that the Dockerfile is in the root of the project directory

# Set the image name
IMAGE_NAME="f5-tts-inference-server"

# Build the Docker image
docker build -t $IMAGE_NAME .

# Check if the build was successful
if [ $? -eq 0 ]; then
    echo "Docker image '$IMAGE_NAME' built successfully."
else
    echo "Failed to build Docker image '$IMAGE_NAME'."
    exit 1
fi

# Optionally, you can push the image to a Docker registry
# Uncomment the following lines if you want to push the image
# docker tag $IMAGE_NAME your_dockerhub_username/$IMAGE_NAME
# docker push your_dockerhub_username/$IMAGE_NAME

# End of script