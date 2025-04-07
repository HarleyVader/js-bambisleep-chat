#!/usr/bin/env python3
import os
import sys
import argparse
import logging
from huggingface_hub import hf_hub_download
import shutil

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description='Download F5-TTS models from HuggingFace')
    parser.add_argument('--model', type=str, 
                        choices=['f5tts_small', 'f5tts_base', 'f5tts_v1_base', 'e2tts_base'], 
                        default='f5tts_small',
                        help='Model version to download')
    parser.add_argument('--output_dir', type=str, default=None, 
                        help='Output directory for downloaded models')
    args = parser.parse_args()
    
    # Determine paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if args.output_dir:
        base_dir = args.output_dir
    else:
        base_dir = os.path.abspath(os.path.join(script_dir, '..', 'F5-TTS'))
    
    # Create directory structure
    models_dir = os.path.join(base_dir, 'models')
    os.makedirs(models_dir, exist_ok=True)
    
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
    
    model_info = model_options[args.model]
    output_filename = f"{args.model}.pt"
    output_path = os.path.join(models_dir, output_filename)
    
    # Download model
    logger.info(f"Downloading {args.model} model from {model_info['repo_id']}...")
    try:
        # Download the model
        downloaded_path = hf_hub_download(
            repo_id=model_info["repo_id"],
            filename=model_info["filename"],
            local_dir=models_dir,
            local_dir_use_symlinks=False
        )
        
        # If the downloaded file isn't in the expected location, move it
        if downloaded_path != output_path:
            logger.info(f"Moving {downloaded_path} to {output_path}")
            shutil.copy2(downloaded_path, output_path)
        
        logger.info(f"Model successfully downloaded to: {output_path}")
        return 0
    except Exception as e:
        logger.error(f"Error downloading model: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())