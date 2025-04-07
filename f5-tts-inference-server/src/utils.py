def load_audio_file(file_path):
    import librosa

    # Load the audio file with librosa
    audio, sr = librosa.load(file_path, sr=None)
    return audio, sr

def save_audio_file(file_path, audio, sr):
    import soundfile as sf

    # Save the audio file using soundfile
    sf.write(file_path, audio, sr)

def download_model_if_not_exists(model_url, model_path):
    import os
    import requests

    # Check if the model already exists
    if not os.path.exists(model_path):
        # Download the model
        response = requests.get(model_url)
        with open(model_path, 'wb') as f:
            f.write(response.content)

def configure_cuda():
    import torch

    # Check if CUDA is available and set the device
    if torch.cuda.is_available():
        device = torch.device("cuda")
    else:
        device = torch.device("cpu")
    return device