# f5-tts-app

## Overview
The f5-tts-app is a text-to-speech (TTS) application that utilizes a DiT-based model architecture for generating high-quality audio from text input. The application is designed to be efficient and easy to use, providing a streamlined inference pipeline and various utility functions for audio and text processing.

## Features
- Core model implementation based on DiT architecture.
- Vocoder for converting mel spectrograms to audio waveforms.
- Utility functions for audio loading, normalization, and saving.
- Text processing utilities for tokenization and normalization.
- Inference pipeline for generating audio from text and reference audio.
- Scripts for downloading model weights and converting audio formats.

## Installation
To set up the f5-tts-app, follow these steps:

1. Clone the repository:
   ```
   git clone <repository-url>
   cd f5-tts-app
   ```

2. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

3. (Optional) Run the download models script to fetch necessary model weights:
   ```
   python scripts/download_models.py
   ```

## Usage
To generate audio from text, you can use the provided inference pipeline. Here’s a simple example:

```python
from src.inference import tts_inference

# Initialize model and vocoder
model = ...  # Load your model here
vocoder = ...  # Load your vocoder here

# Generate audio
audio = tts_inference("Hello, world!", reference_audio="data/reference_audio/example.wav", model=model, vocoder=vocoder)

# Save the output
from scipy.io.wavfile import write
write("output.wav", 24000, audio)
```

## Directory Structure
- `src/`: Contains the main application code, including models, utilities, and inference logic.
- `scripts/`: Includes scripts for downloading models and converting audio files.
- `tests/`: Contains unit tests for the application components.
- `data/`: Stores sample and reference audio files.
- `requirements.txt`: Lists the dependencies required for the project.
- `setup.py`: Setup script for package installation.
- `.gitignore`: Specifies files to be ignored by version control.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.