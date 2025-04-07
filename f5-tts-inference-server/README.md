# F5-TTS Inference Server

## Overview
The F5-TTS Inference Server is a lightweight and performant server designed to provide text-to-speech capabilities using the F5-TTS model. This project utilizes NVIDIA CUDA for efficient GPU memory usage and is configured to handle inference requests with minimal overhead.

## Project Structure
```
f5-tts-inference-server
├── src                     # Source code for the inference server
│   ├── server.py          # Entry point for the inference server
│   ├── inference.py       # Logic for performing inference
│   ├── download_model.py   # Handles downloading the F5-TTS small model
│   ├── config.py          # Configuration settings for the server and inference
│   └── utils.py           # Utility functions for audio handling and model loading
├── config                  # Configuration files
│   ├── inference_config.toml # Inference process configuration
│   └── server_config.json  # Server configuration settings
├── data                    # Data directory
│   └── reference_audio
│       └── bambi.wav      # Reference audio file for inference
├── scripts                 # Scripts for building and running the server
│   ├── build.sh           # Builds the Docker image
│   ├── run.sh             # Runs the inference server
│   └── download_model.sh   # Automates model downloading
├── tests                   # Unit tests for the project
│   ├── test_inference.py   # Tests for inference logic
│   └── test_server.py      # Tests for server functionality
├── Dockerfile              # Docker image definition
├── docker-compose.yml      # Multi-container Docker application definition
├── requirements.txt        # Python dependencies
├── setup.py                # Packaging information
└── README.md               # Project documentation
```

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/f5-tts-inference-server.git
   cd f5-tts-inference-server
   ```

2. **Set up a Python environment:**
   It is recommended to use a virtual environment. You can create one using `venv` or `conda`.

   ```bash
   python -m venv .f5-tts
   source .f5-tts/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. **Install dependencies:**
   Install the required Python packages using pip:
   ```bash
   pip install -r requirements.txt
   ```

## Downloading the F5-TTS Model

To download the F5-TTS small model, run the following script:
```bash
bash scripts/download_model.sh
```

## Running the Inference Server

You can run the inference server using the provided script:
```bash
bash scripts/run.sh
```

This will start the server, which will listen for incoming inference requests.

## Usage

Once the server is running, you can send audio files for inference. The server is configured to use `bambi.wav` as the reference audio file. Ensure that your requests are formatted correctly according to the server's API specifications.

## Testing

To run the unit tests for the inference logic and server functionality, execute:
```bash
pytest tests/
```

## License

This project is licensed under the MIT License. See the LICENSE file for more details.

## Acknowledgments

Thanks to the contributors and the community for their support in developing this project.