# Contents of /f5-tts-inference-server/f5-tts-inference-server/src/config.py

import json
import toml
import os

class Config:
    def __init__(self, server_config_path='config/server_config.json', inference_config_path='config/inference_config.toml'):
        self.server_config = self.load_server_config(server_config_path)
        self.inference_config = self.load_inference_config(inference_config_path)

    def load_server_config(self, path):
        if not os.path.exists(path):
            raise FileNotFoundError(f"Server configuration file not found: {path}")
        with open(path, 'r') as f:
            return json.load(f)

    def load_inference_config(self, path):
        if not os.path.exists(path):
            raise FileNotFoundError(f"Inference configuration file not found: {path}")
        return toml.load(path)

    def get_server_host(self):
        return self.server_config.get('host', '0.0.0.0')

    def get_server_port(self):
        return self.server_config.get('port', 7860)

    def get_model_parameters(self):
        return self.inference_config.get('model_parameters', {})

    def get_audio_processing_options(self):
        return self.inference_config.get('audio_processing', {})

config = Config()