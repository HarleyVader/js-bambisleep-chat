#!/bin/bash

echo "Setting up F5-TTS directory structure..."

# Define paths
BASE_DIR=$(dirname "$0")
F5_TTS_DIR="$BASE_DIR/../F5-TTS"
F5_TTS_SRC="$F5_TTS_DIR/src"
F5_TTS_MODELS="$F5_TTS_DIR/models"
F5_TTS_CONFIG="$F5_TTS_SRC/f5_tts/configs"

# Create directory structure
mkdir -p "$F5_TTS_SRC/f5_tts/configs"
mkdir -p "$F5_TTS_MODELS"

# Create __init__.py files
touch "$F5_TTS_DIR/__init__.py"
touch "$F5_TTS_SRC/__init__.py"
mkdir -p "$F5_TTS_SRC/f5_tts"
touch "$F5_TTS_SRC/f5_tts/__init__.py"
touch "$F5_TTS_SRC/f5_tts/configs/__init__.py"

# Try to download config file from GitHub
if [ ! -f "$F5_TTS_CONFIG/F5TTS_Small.yaml" ]; then
  echo "Downloading F5TTS_Small.yaml from GitHub..."
  if command -v curl &> /dev/null; then
    curl -s "https://raw.githubusercontent.com/SWivid/F5-TTS/main/src/f5_tts/configs/F5TTS_Small.yaml" > "$F5_TTS_CONFIG/F5TTS_Small.yaml"
  elif command -v wget &> /dev/null; then
    wget -q -O "$F5_TTS_CONFIG/F5TTS_Small.yaml" "https://raw.githubusercontent.com/SWivid/F5-TTS/main/src/f5_tts/configs/F5TTS_Small.yaml"
  else
    echo "Neither curl nor wget is available. Using Python to download..."
    python -c "import requests; open('$F5_TTS_CONFIG/F5TTS_Small.yaml', 'wb').write(requests.get('https://raw.githubusercontent.com/SWivid/F5-TTS/main/src/f5_tts/configs/F5TTS_Small.yaml').content)"
  fi

  if [ -f "$F5_TTS_CONFIG/F5TTS_Small.yaml" ]; then
    echo "Successfully downloaded F5TTS_Small.yaml"
  else
    echo "Failed to download F5TTS_Small.yaml"
  fi
fi

# Clone required modules from F5-TTS repository if not already present
if [ ! -d "$F5_TTS_SRC/f5_tts/models" ]; then
  echo "Cloning F5-TTS source files from GitHub..."
  git clone --depth 1 https://github.com/SWivid/F5-TTS.git "$BASE_DIR/temp_f5tts"

  if [ -d "$BASE_DIR/temp_f5tts" ]; then
    # Copy essential files
    cp -r "$BASE_DIR/temp_f5tts/src/f5_tts"/* "$F5_TTS_SRC/f5_tts/"
    echo "Copied F5-TTS source files to $F5_TTS_SRC/f5_tts/"
    
    # Clean up
    rm -rf "$BASE_DIR/temp_f5tts"
  else
    echo "Warning: Failed to clone F5-TTS repository"
  fi
fi

echo "F5-TTS structure setup complete!"