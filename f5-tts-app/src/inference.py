from .models.model import load_model
from .models.vocoder import load_vocoder
from .utils.audio import load_audio, normalize_mel
from .utils.text import text_to_sequence, clean_text
import torch
import numpy as np

class F5TTS:
    def __init__(self, model_path, vocab_file, device="cuda", dtype="float32"):
        self.device = device
        self.model = load_model(model_path, vocab_file, device)
        self.vocoder = load_vocoder(device)
        self.dtype = dtype

    def tts(self, text, reference_audio, cfg_scale=2.0):
        audio = tts_inference(text, reference_audio, self.model, self.vocoder, cfg_scale)
        return audio

def tts_inference(text, reference_audio=None, model=None, vocoder=None, config=None):
    """
    Generate speech from text using the F5-TTS model.
    
    Args:
        text (str): Text to convert to speech
        reference_audio (str, optional): Path to reference audio file for voice cloning
        model: Loaded model instance (will be loaded from config if not provided)
        vocoder: Loaded vocoder instance (will be loaded from config if not provided)
        config (dict, optional): Model configuration
        
    Returns:
        numpy.ndarray: Waveform audio data
    """
    # Clean and preprocess text
    cleaned_text = clean_text(text)
    
    # Convert text to sequence
    text_seq = text_to_sequence(cleaned_text)
    text_tensor = torch.LongTensor([text_seq])
    
    # Load reference audio if provided
    reference_mel = None
    if reference_audio:
        reference_data = load_audio(reference_audio)
        # Process reference audio to get mel spectrogram
        # This would depend on your model's specific requirements
        reference_mel = process_reference_audio(reference_data)
    
    # Generate mel spectrogram
    with torch.no_grad():
        mel = model.generate(text_tensor, reference_mel)
    
    # Convert mel spectrogram to audio
    audio = vocoder(mel)
    
    # Convert to numpy array
    if isinstance(audio, torch.Tensor):
        audio = audio.squeeze().cpu().numpy()
    
    return audio

def process_reference_audio(audio_data):
    """
    Process reference audio for voice cloning.
    
    Args:
        audio_data: Audio data loaded from file
        
    Returns:
        torch.Tensor: Processed reference mel spectrogram
    """
    # This is a placeholder - implement based on your model's requirements
    # Convert audio to mel spectrogram, normalize, etc.
    return torch.tensor(audio_data)