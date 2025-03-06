import sys
import torch
import torchaudio
from zonos.model import Zonos
from zonos.conditioning import make_cond_dict
from zonos.utils import DEFAULT_DEVICE as device

# model = Zonos.from_pretrained("Zyphra/Zonos-v0.1-hybrid", device=device)
model = Zonos.from_pretrained("Zyphra/Zonos-v0.1-transformer", device=device)

text = sys.argv[1] if len(sys.argv) > 1 else "Hello, world!"
filename = sys.argv[2] if len(sys.argv) > 2 else "bambi.wav"

wav, sampling_rate = torchaudio.load("assets/bambi.wav")
speaker = model.make_speaker_embedding(wav, sampling_rate)

torch.manual_seed(421)

cond_dict = make_cond_dict(text=text, speaker=speaker, language="en-us")
conditioning = model.prepare_conditioning(cond_dict)

codes = model.generate(conditioning)

wavs = model.autoencoder.decode(codes).cpu()
torchaudio.save(f"assets/audio/{filename}", wavs[0], model.autoencoder.sampling_rate)
