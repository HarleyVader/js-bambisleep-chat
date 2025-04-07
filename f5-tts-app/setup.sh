#!/bin/bash

# Fix for WSL paths
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Running on Linux/WSL
  BASE_DIR=$(dirname "$(readlink -f "$0")")
else
  # Assume Windows
  BASE_DIR=$(dirname "$0")
fi

echo "Setting up F5-TTS App..."
echo "Base directory: $BASE_DIR"

# Fix any DOS line endings in scripts
if command -v dos2unix &> /dev/null; then
  find "$BASE_DIR" -type f -name "*.py" -o -name "*.sh" | xargs dos2unix
  echo "Converted scripts to Unix format"
fi

# Install required packages
echo "Installing Python dependencies..."
pip install -r "$BASE_DIR/requirements.txt"

# Add huggingface_hub package if not in requirements
pip install huggingface_hub requests

# Create output directory
mkdir -p "$BASE_DIR/output"

# Set up F5-TTS structure
echo "Setting up F5-TTS directory structure..."
bash "$BASE_DIR/setup_structure.sh"

# Create config file if it doesn't exist
if [ ! -f "$BASE_DIR/config.yaml" ]; then
  echo "Creating config.yaml..."
  
  # Determine paths based on OS
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # WSL paths
    MODEL_PATH="/mnt/f/js-bambisleep-chat/F5-TTS/models/f5tts_small.pt"
    CONFIG_PATH="/mnt/f/js-bambisleep-chat/F5-TTS/src/f5_tts/configs/F5TTS_Small.yaml"
  else
    # Windows paths
    MODEL_PATH="../F5-TTS/models/f5tts_small.pt"
    CONFIG_PATH="../F5-TTS/src/f5_tts/configs/F5TTS_Small.yaml"
  fi
  
  cat > "$BASE_DIR/config.yaml" << EOL
# F5-TTS Server Configuration

# Path to the model checkpoint
model_path: "$MODEL_PATH"

# Path to the model configuration
config_path: "$CONFIG_PATH"

# Output directory for generated audio files
output_dir: "output"

# Server settings
server:
  host: "0.0.0.0"
  port: 5002
  debug: false
EOL
fi

# Run the model setup
echo "Downloading and setting up F5-TTS model..."
python "$BASE_DIR/setup_model.py" --model f5tts_small

echo "Setup complete!"
echo "You can now run the server with: python server.py --port 5002"