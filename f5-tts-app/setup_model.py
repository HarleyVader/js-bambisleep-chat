import os
import sys
import shutil
import yaml
import argparse
import requests
from pathlib import Path
from huggingface_hub import hf_hub_download
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def windows_to_wsl_path(path):
    """Convert Windows path to WSL path format."""
    if path.startswith('f:'):
        return path.replace('f:', '/mnt/f')
    return path

def wsl_to_windows_path(path):
    """Convert WSL path to Windows path format."""
    if path.startswith('/mnt/f'):
        return path.replace('/mnt/f', 'f:')
    return path

def create_directory(path):
    """Create directory if it doesn't exist."""
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)
        logger.info(f"Created directory: {path}")

def download_model(model_name, output_path):
    """Download model from Hugging Face."""
    # Model options with their filenames
    model_options = {
        "f5tts_small": {
            "repo_id": "SWivid/F5-TTS",
            "filename": "F5TTS_Small/model_1200000.safetensors",
        },
        "f5tts_base": {
            "repo_id": "SWivid/F5-TTS",
            "filename": "F5TTS_Base/model_1200000.safetensors",
        },
        "f5tts_v1_base": {
            "repo_id": "SWivid/F5-TTS",
            "filename": "F5TTS_v1_Base/model_1250000.safetensors",
        },
        "e2tts_base": {
            "repo_id": "SWivid/F5-TTS",
            "filename": "E2TTS_Base/model_1200000.safetensors",
        }
    }
    
    if model_name not in model_options:
        logger.error(f"Unknown model: {model_name}. Available models: {', '.join(model_options.keys())}")
        return False
    
    model_info = model_options[model_name]
    try:
        logger.info(f"Downloading {model_name} from {model_info['repo_id']}...")
        output_dir = os.path.dirname(output_path)
        os.makedirs(output_dir, exist_ok=True)
        
        # Download the model
        downloaded_path = hf_hub_download(
            repo_id=model_info["repo_id"],
            filename=model_info["filename"],
            local_dir=output_dir,
            local_dir_use_symlinks=False
        )
        
        # If the downloaded file isn't in the expected location, move it
        if downloaded_path != output_path:
            logger.info(f"Moving {downloaded_path} to {output_path}")
            shutil.move(downloaded_path, output_path)
        
        logger.info(f"Successfully downloaded model to {output_path}")
        return True
    except Exception as e:
        logger.error(f"Error downloading model: {e}")
        return False

def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Setup F5-TTS model and configuration')
    parser.add_argument('--model', type=str, choices=['f5tts_small', 'f5tts_base', 'f5tts_v1_base', 'e2tts_base'], 
                        default='f5tts_small', help='Model version to download')
    parser.add_argument('--no_download', action='store_true', help='Skip model download')
    args = parser.parse_args()

    # Set up paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    windows_base_dir = 'f:\\js-bambisleep-chat'
    wsl_base_dir = '/mnt/f/js-bambisleep-chat'
    
    # Convert paths based on the platform
    if sys.platform == 'win32':
        base_dir = windows_base_dir
        f5_tts_app_dir = os.path.join(base_dir, 'f5-tts-app')
        f5_tts_dir = os.path.join(base_dir, 'F5-TTS')
    else:
        base_dir = wsl_base_dir
        f5_tts_app_dir = os.path.join(base_dir, 'f5-tts-app')
        f5_tts_dir = os.path.join(base_dir, 'F5-TTS')

    # Create necessary directories
    models_dir = os.path.join(f5_tts_dir, 'models')
    config_dir = os.path.join(f5_tts_dir, 'src', 'f5_tts', 'configs')
    create_directory(models_dir)
    create_directory(config_dir)
    
    # Copy the config file if it exists
    config_source = os.path.join(f5_tts_app_dir, 'F5TTS_Small.yaml')
    config_dest = os.path.join(config_dir, 'F5TTS_Small.yaml')
    
    if os.path.exists(config_source):
        logger.info(f"Copying config from {config_source} to {config_dest}")
        shutil.copy2(config_source, config_dest)
    else:
        logger.warning(f"Config file not found at {config_source}")
        # Try to download config file from the repository
        try:
            logger.info("Attempting to download config file from GitHub...")
            config_url = "https://raw.githubusercontent.com/SWivid/F5-TTS/main/src/f5_tts/configs/F5TTS_Small.yaml"
            response = requests.get(config_url)
            response.raise_for_status()
            with open(config_dest, 'wb') as f:
                f.write(response.content)
            logger.info(f"Successfully downloaded config to {config_dest}")
        except Exception as e:
            logger.error(f"Error downloading config: {e}")
    
    # Download or create model file
    model_filename = f"{args.model}.pt"
    model_path = os.path.join(models_dir, model_filename)
    
    if not os.path.exists(model_path):
        if args.no_download:
            logger.info(f"Creating placeholder model file at {model_path}")
            with open(model_path, 'wb') as f:
                f.write(b'PLACEHOLDER_MODEL_DOWNLOAD_ACTUAL_MODEL_FILE')
        else:
            logger.info(f"Downloading model {args.model}...")
            success = download_model(args.model, model_path)
            if not success:
                logger.warning("Failed to download model. Creating placeholder file.")
                with open(model_path, 'wb') as f:
                    f.write(b'PLACEHOLDER_MODEL_DOWNLOAD_ACTUAL_MODEL_FILE')
    else:
        logger.info(f"Model already exists at {model_path}")
    
    # Update the config.yaml file with correct paths
    config_yaml_path = os.path.join(f5_tts_app_dir, 'config.yaml')
    
    # Determine which path format to use based on platform
    if sys.platform == 'win32':
        model_path_config = os.path.join(f5_tts_dir, 'models', model_filename)
        config_path_config = os.path.join(f5_tts_dir, 'src', 'f5_tts', 'configs', 'F5TTS_Small.yaml')
    else:
        model_path_config = os.path.join(wsl_base_dir, 'F5-TTS', 'models', model_filename)
        config_path_config = os.path.join(wsl_base_dir, 'F5-TTS', 'src', 'f5_tts', 'configs', 'F5TTS_Small.yaml')
    
    config_data = {
        'model_path': model_path_config,
        'config_path': config_path_config,
        'output_dir': 'output',
        'server': {
            'host': '0.0.0.0',
            'port': 5002,
            'debug': False
        }
    }
    
    with open(config_yaml_path, 'w') as f:
        yaml.safe_dump(config_data, f, default_flow_style=False)
    
    logger.info(f"Updated configuration at {config_yaml_path}")
    logger.info("Setup complete. You should now be able to run the server.")
    logger.info("Run: python server.py --port 5002")

if __name__ == "__main__":
    main()