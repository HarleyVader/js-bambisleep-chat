#!/bin/bash

# Create a directory for the model if it doesn't exist
MODEL_DIR="./models"
mkdir -p $MODEL_DIR

# Download the F5-TTS small model
MODEL_URL="https://huggingface.co/SWivid/F5-TTS/resolve/main/models/f5-tts-small.pt"
MODEL_PATH="$MODEL_DIR/f5-tts-small.pt"

if [ ! -f "$MODEL_PATH" ]; then
    echo "Downloading F5-TTS small model..."
    wget -O "$MODEL_PATH" "$MODEL_URL"
else
    echo "F5-TTS small model already exists. Skipping download."
fi

# Ensure the model is downloaded
if [ -f "$MODEL_PATH" ]; then
    echo "Model downloaded successfully to $MODEL_PATH"
else
    echo "Failed to download the model."
    exit 1
fi