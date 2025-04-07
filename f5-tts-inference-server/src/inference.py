from f5_tts import F5TTS
import torch
import torchaudio
import os

class InferenceServer:
    def __init__(self, model_path, reference_audio_path):
        self.model = F5TTS.from_pretrained(model_path)
        self.reference_audio_path = reference_audio_path

    def load_audio(self):
        waveform, sample_rate = torchaudio.load(self.reference_audio_path)
        return waveform, sample_rate

    def generate_text(self, waveform):
        with torch.no_grad():
            generated_text = self.model.infer(waveform)
        return generated_text

    def run_inference(self):
        waveform, sample_rate = self.load_audio()
        generated_text = self.generate_text(waveform)
        return generated_text

if __name__ == "__main__":
    model_path = "path/to/f5-tts-small-model"  # Update with the actual model path
    reference_audio_path = os.path.join("data", "reference_audio", "bambi.wav")
    
    inference_server = InferenceServer(model_path, reference_audio_path)
    output_text = inference_server.run_inference()
    print("Generated Text:", output_text)