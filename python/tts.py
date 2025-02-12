import sys
import torch
from TTS.api import TTS

def main():
    if len(sys.argv) < 4:
        print("Usage: python tts.py <text> <speaker_wav> <language> <output_file>")
        return

    text = sys.argv[1]
    speaker_wav = sys.argv[2]
    language = sys.argv[3]
    output_file = sys.argv[4]

    device = "cuda" if torch.cuda.is_available() else "cpu"
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
    tts.tts_to_file(text=text, speaker_wav=speaker_wav, language=language, file_path=output_file)

if __name__ == "__main__":
    main()
