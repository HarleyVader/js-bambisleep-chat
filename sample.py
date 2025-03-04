import sys
import os
import torch
import torchaudio
from zonos.model import Zonos
from zonos.conditioning import make_cond_dict
from zonos.utils import DEFAULT_DEVICE as device

text = sys.argv[1] if len(sys.argv) > 1 else "Brandynette is the bestest bambi"
filename = sys.argv[2] if len(sys.argv) > 2 else "sample.wav"

# model = Zonos.from_pretrained("Zyphra/Zonos-v0.1-hybrid", device=device)
model = Zonos.from_pretrained("Zyphra/Zonos-v0.1-transformer", device=device)

wav_path = os.path.join(os.path.dirname(__file__), "assets/bambi.wav")
wav, sampling_rate = torchaudio.load(wav_path)
speaker = model.make_speaker_embedding(wav, sampling_rate)

torch.manual_seed(421)

cond_dict = make_cond_dict(text=text, speaker=speaker, language="en-us")
conditioning = model.prepare_conditioning(cond_dict)

codes = model.generate(conditioning)

wavs = model.autoencoder.decode(codes).cpu()
output_dir = os.path.join(os.path.dirname(__file__), 'assets/audio')
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, filename)
torchaudio.save(output_path, wavs[0], model.autoencoder.sampling_rate)

print(filename)
