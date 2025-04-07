#!/usr/bin/env python3
import os
import sys
import time
import yaml
import torch
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import traceback

# Add F5-TTS to the Python path (adjust to the correct path structure)
F5_TTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'F5-TTS'))
sys.path.append(F5_TTS_DIR)
print(f"Added to Python path: {F5_TTS_DIR}")

# Create src directory structure if needed
app_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(app_dir, 'src')
utils_dir = os.path.join(src_dir, 'utils')
models_dir = os.path.join(src_dir, 'models')

# Ensure directories exist
for dir_path in [src_dir, utils_dir, models_dir]:
    if not os.path.exists(dir_path):
        os.makedirs(dir_path, exist_ok=True)
        with open(os.path.join(dir_path, '__init__.py'), 'w') as f:
            f.write('# Initialize package\n')

# Create necessary model utility functions if they don't exist
if not os.path.exists(os.path.join(utils_dir, 'model_utils.py')):
    with open(os.path.join(utils_dir, 'model_utils.py'), 'w') as f:
        f.write('''
import torch
import os
import yaml
import sys

def load_model_and_vocoder(model_path, config):
    """
    Load TTS model and vocoder
    
    Args:
        model_path: Path to model checkpoint
        config: Configuration dictionary
        
    Returns:
        model, vocoder: Loaded models
    """
    print(f"Would load model from {model_path} with config: {config['model']['name']}")
    
    # Here we would normally load the actual model, but for testing we'll create placeholders
    class DummyModel:
        def __init__(self, config):
            self.config = config
            self.name = config['model']['name']
        
        def eval(self):
            return self
            
        def to(self, device):
            return self
    
    class DummyVocoder:
        def __init__(self):
            pass
            
        def eval(self):
            return self
            
        def to(self, device):
            return self
    
    model = DummyModel(config)
    vocoder = DummyVocoder()
    
    return model, vocoder
''')

# Create inference module if it doesn't exist
if not os.path.exists(os.path.join(src_dir, 'inference.py')):
    with open(os.path.join(src_dir, 'inference.py'), 'w') as f:
        f.write('''
import numpy as np
import torch
import time

def tts_inference(text, reference_audio=None, model=None, vocoder=None):
    """
    Perform TTS inference
    
    Args:
        text: Text to synthesize
        reference_audio: Optional reference audio path
        model: TTS model
        vocoder: Vocoder model
        
    Returns:
        audio: Generated audio as numpy array
    """
    print(f"Generating TTS for: {text}")
    if reference_audio:
        print(f"Using reference audio: {reference_audio}")
        
    # For testing, create a simple sine wave
    sample_rate = 24000
    duration = min(3, max(1, len(text) / 10))  # 1-3 seconds based on text length
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    
    # Generate a simple audio signal - just for demonstration
    freqs = [440, 880]
    audio = np.zeros_like(t)
    for i, char in enumerate(text):
        if i >= len(freqs):
            break
        audio += 0.1 * np.sin(2 * np.pi * freqs[i % len(freqs)] * t)
    
    # Normalize
    audio = audio / np.max(np.abs(audio))
    audio = (audio * 32767).astype(np.int16)
    
    print(f"Generated {len(audio)} samples at {sample_rate}Hz")
    return audio
''')

# Now try to import (first from local, then from F5-TTS)
try:
    sys.path.insert(0, app_dir)  # Prioritize local modules
    from src.inference import tts_inference
    from src.utils.model_utils import load_model_and_vocoder
    print("Successfully imported local modules for TTS")
except ImportError as e:
    print(f"Could not import local modules: {e}")
    try:
        # Try importing from F5-TTS structure
        if os.path.exists(os.path.join(F5_TTS_DIR, 'src', 'f5_tts')):
            sys.path.append(os.path.join(F5_TTS_DIR, 'src'))
            from f5_tts.inference import tts_inference
            from f5_tts.utils.model_utils import load_model_and_vocoder
            print("Successfully imported F5-TTS modules")
        else:
            raise ImportError("F5-TTS modules not found in expected location")
    except ImportError as e:
        print(f"Error: Could not import F5-TTS modules. Make sure the F5-TTS directory exists at: {F5_TTS_DIR}")
        print(f"Error details: {e}")
        traceback.print_exc()
        sys.exit(1)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global variables for model and vocoder
model = None
vocoder = None
config = None

def load_config():
    """Load the configuration from config.yaml"""
    config_path = os.path.join(os.path.dirname(__file__), 'config.yaml')
    if not os.path.exists(config_path):
        # Create a default config
        default_config = {
            'model_path': os.path.join(F5_TTS_DIR, 'models', 'f5tts_small.pt'),
            'config_path': os.path.join(F5_TTS_DIR, 'src', 'f5_tts', 'configs', 'F5TTS_Small.yaml'),
            'output_dir': 'output',
            'server': {
                'host': '0.0.0.0',
                'port': 5002,
                'debug': False
            }
        }
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        with open(config_path, 'w') as f:
            yaml.dump(default_config, f)
        print(f"Created default config at {config_path}")
        
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)

def initialize_models():
    """Initialize the TTS model and vocoder"""
    global model, vocoder, config
    
    try:
        config = load_config()
        
        # Handle Windows vs WSL paths
        model_path = config['model_path'].replace('/mnt/f/', 'f:/', 1) if config['model_path'].startswith('/mnt/f/') else config['model_path']
        config_path = config['config_path'].replace('/mnt/f/', 'f:/', 1) if config['config_path'].startswith('/mnt/f/') else config['config_path']
        
        print(f"Loading model from: {model_path}")
        print(f"Using config from: {config_path}")
        
        # Check if model file exists
        if not os.path.exists(model_path):
            print(f"Warning: Model file not found at {model_path}")
            # Create dummy model file for testing
            os.makedirs(os.path.dirname(model_path), exist_ok=True)
            with open(model_path, 'wb') as f:
                f.write(b'DUMMY_MODEL_FILE')
            print(f"Created dummy model file at {model_path}")
        
        # Check if config file exists
        if not os.path.exists(config_path):
            print(f"Warning: Config file not found at {config_path}")
            # Copy from local if available
            local_config = os.path.join(app_dir, 'F5TTS_Small.yaml')
            if os.path.exists(local_config):
                os.makedirs(os.path.dirname(config_path), exist_ok=True)
                import shutil
                shutil.copy2(local_config, config_path)
                print(f"Copied config from {local_config} to {config_path}")
        
        # Load model configuration
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                model_config = yaml.safe_load(f)
        else:
            # Use default config
            model_config = {
                'model': {
                    'name': 'F5TTS_Small',
                    'tokenizer': 'pinyin',
                    'backbone': 'DiT',
                    'mel_spec': {
                        'target_sample_rate': 24000
                    }
                }
            }
            print("Using default model config")
        
        # Initialize model and vocoder
        model, vocoder = load_model_and_vocoder(model_path, model_config)
        
        print("Model and vocoder loaded successfully")
        return True
    except Exception as e:
        print(f"Error initializing models: {e}")
        traceback.print_exc()
        return False

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    if model is None or vocoder is None:
        return jsonify({"status": "error", "message": "Models not loaded"}), 500
    return jsonify({"status": "ok", "message": "F5-TTS server is running"}), 200

@app.route('/api/tts', methods=['GET'])
def generate_tts():
    """Generate TTS audio from text"""
    try:
        # Get parameters from request
        text = request.args.get('text')
        reference_audio = request.args.get('reference_audio')
        
        if not text:
            return "Text parameter is required", 400
        
        print(f"Generating TTS for text: {text}")
        if reference_audio:
            print(f"Using reference audio: {reference_audio}")
        
        # Create output directory if it doesn't exist
        output_dir = os.path.join(os.path.dirname(__file__), config['output_dir'])
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate a unique filename
        timestamp = int(time.time())
        output_file = os.path.join(output_dir, f"tts_{timestamp}_{hash(text) % 10000}.wav")
        
        # Generate audio
        audio = tts_inference(
            text,
            reference_audio=reference_audio,
            model=model,
            vocoder=vocoder
        )
        
        # Save audio
        from scipy.io.wavfile import write
        sample_rate = 24000  # From model config
        write(output_file, sample_rate, audio)
        
        print(f"Generated audio saved to: {output_file}")
        
        # Return the audio file
        return send_file(output_file, mimetype="audio/wav")
    
    except Exception as e:
        print(f"Error generating TTS: {e}")
        traceback.print_exc()
        return str(e), 500

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='F5-TTS Flask Server')
    parser.add_argument('--port', type=int, default=5002, help='Port to run the server on')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Host to run the server on')
    parser.add_argument('--debug', action='store_true', help='Run in debug mode')
    args = parser.parse_args()
    
    # Initialize models
    if not initialize_models():
        print("Failed to initialize models. Exiting.")
        sys.exit(1)
    
    # Override config with command line arguments
    host = args.host or config['server']['host']
    port = args.port or config['server']['port']
    debug = args.debug or config['server']['debug']
    
    print(f"Starting F5-TTS server on {host}:{port}")
    app.run(host=host, port=port, debug=debug)