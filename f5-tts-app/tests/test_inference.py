import unittest
from src.inference import tts_inference
from src.models.model import load_model
from src.models.vocoder import load_optimized_bigvgan

class TestInference(unittest.TestCase):

    def setUp(self):
        self.model_path = "models/F5TTS_Small/model_latest.safetensors"
        self.vocab_file = "models/F5TTS_Small/vocab.txt"
        self.device = "cuda"
        
        # Load model and vocoder
        self.model = load_model(self.model_path, self.vocab_file, self.device)
        self.vocoder = load_optimized_bigvgan()

    def test_tts_inference(self):
        text = "这是一个例子"
        reference_audio = "data/reference_audio/reference.wav"
        
        # Run inference
        audio_output = tts_inference(text, reference_audio, self.model, self.vocoder)
        
        # Check if output is not None
        self.assertIsNotNone(audio_output)
        
        # Check if output is of expected type
        self.assertIsInstance(audio_output, (list, np.ndarray))

    def tearDown(self):
        del self.model
        del self.vocoder

if __name__ == '__main__':
    unittest.main()