import numpy as np
import torch
from scipy.io import wavfile
import librosa

def load_audio(file_path, target_sr=24000):
    """
    Load audio file and resample if necessary
    
    Args:
        file_path: Path to audio file
        target_sr: Target sample rate
        
    Returns:
        numpy.ndarray: Audio data
    """
    try:
        # Try to use scipy.io.wavfile for loading
        sr, audio = wavfile.read(file_path)
        
        # Convert to float32 if needed
        if audio.dtype == np.int16:
            audio = audio.astype(np.float32) / 32768.0
        elif audio.dtype == np.int32:
            audio = audio.astype(np.float32) / 2147483648.0
        
        # Resample if needed
        if sr != target_sr:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sr)
            
        return audio
    except Exception as e:
        # Fall back to librosa
        print(f"Using librosa fallback for loading audio: {e}")
        audio, sr = librosa.load(file_path, sr=target_sr)
        return audio

def save_audio(file_path, audio, sample_rate=24000):
    import soundfile as sf
    sf.write(file_path, audio, sample_rate)

def normalize_audio(audio):
    return audio / max(abs(audio)) if max(abs(audio)) > 0 else audio

def trim_audio(audio, top_db=20):
    import librosa
    return librosa.effects.trim(audio, top_db=top_db)[0]

def normalize_mel(mel, min_level_db=-100, max_level_db=0):
    """Normalize mel spectrogram"""
    mel_normalized = (mel - min_level_db) / (max_level_db - min_level_db)
    mel_normalized = torch.clamp(mel_normalized, 0.0, 1.0)
    return mel_normalized