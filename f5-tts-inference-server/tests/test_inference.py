import unittest
from src.inference import perform_inference

class TestInference(unittest.TestCase):
    def setUp(self):
        self.audio_file = "data/reference_audio/bambi.wav"
        self.expected_output = "Expected text output from the model"  # Replace with actual expected output

    def test_inference_output(self):
        output = perform_inference(self.audio_file)
        self.assertEqual(output, self.expected_output)

    def test_inference_with_invalid_audio(self):
        invalid_audio_file = "data/reference_audio/invalid.wav"
        with self.assertRaises(FileNotFoundError):
            perform_inference(invalid_audio_file)

if __name__ == "__main__":
    unittest.main()