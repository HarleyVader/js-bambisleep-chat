#!/bin/bash

# Create a conda environment for F5-TTS
conda create -n f5-tts python=3.10 -y
conda activate f5-tts

# Install required packages
pip install -r requirements.txt

# Download the F5-TTS small model
bash scripts/download_model.sh

# Run the inference server
python src/server.py --ref_audio data/reference_audio/bambi.wav --config config/inference_config.toml