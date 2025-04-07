import unittest
from src.models.model import CFM, DiT
from src.utils.audio import load_audio
from src.utils.text import preprocess_text

class TestModel(unittest.TestCase):

    def setUp(self):
        model_cfg = {
            "dim": 768,
            "depth": 18,
            "heads": 12,
            "ff_mult": 2,
            "text_dim": 512,
            "conv_layers": 4
        }
        self.model = CFM(transformer=DiT(**model_cfg))
        self.model.eval()

    def test_model_initialization(self):
        self.assertIsNotNone(self.model)

    def test_forward_pass(self):
        sample_text = "This is a test."
        processed_text = preprocess_text(sample_text)
        mel_output = self.model.sample(text=processed_text, cond=None, steps=16, cfg_strength=2.0, sway_sampling_coef=-1)
        self.assertIsNotNone(mel_output)

    def test_audio_loading(self):
        audio_path = 'data/reference_audio/sample.wav'
        audio_data = load_audio(audio_path)
        self.assertIsNotNone(audio_data)

if __name__ == '__main__':
    unittest.main()