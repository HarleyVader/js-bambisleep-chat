# Configuration settings for the F5-TTS application

model_config = {
    "model_name": "F5TTS_Small",
    "vocoder": "vocos",
    "use_fp16": True,
    "batch_size": 1,
    "device": "cuda:0"
}

audio_config = {
    "sample_rate": 24000,
    "n_mel_channels": 100,
    "n_fft": 1024,
    "hop_length": 256,
    "win_length": 1024
}

text_config = {
    "max_length": 512,
    "tokenizer": "path/to/tokenizer"
}