import sys
import os
import yaml
import torch
import time
import argparse
from pathlib import Path

# Adjust this path to point to your F5-TTS installation
F5_TTS_PATH = os.path.join(os.path.dirname(__file__), '..', 'F5-TTS')
sys.path.append(F5_TTS_PATH)

from src.inference import tts_inference
from src.utils.model_utils import load_model_and_vocoder

def main():
    parser = argparse.ArgumentParser(description='F5-TTS Wrapper')
    parser.add_argument('--text', type=str, required=True, help='Text to synthesize')
    parser.add_argument('--config', type=str, required=True, help='Path to config file')
    parser.add_argument('--model_path', type=str, required=True, help='Path to model checkpoint')
    parser.add_argument('--reference_audio', type=str, default=None, help='Path to reference audio')
    parser.add_argument('--output_dir', type=str, default='temp/audio', help='Output directory')
    args = parser.parse_args()

    # Load configuration
    with open(args.config, 'r') as f:
        config = yaml.safe_load(f)
    
    # Load model and vocoder
    model, vocoder = load_model_and_vocoder(args.model_path, config)
    
    # Ensure output directory exists
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Generate unique filename
    output_path = os.path.join(args.output_dir, f"tts_{int(time.time())}_{hash(args.text) % 10000}.wav")
    
    # Generate audio
    audio = tts_inference(
        args.text, 
        reference_audio=args.reference_audio,
        model=model, 
        vocoder=vocoder
    )
    
    # Save the output
    from scipy.io.wavfile import write
    write(output_path, 24000, audio)
    
    # Print the output path for the Node.js application to capture
    print(output_path)

if __name__ == "__main__":
    main()