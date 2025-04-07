import unittest
from src.server import create_app

class TestServer(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()

    def test_home_page(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Welcome to the F5-TTS Inference Server', response.data)

    def test_inference_endpoint(self):
        with open('data/reference_audio/bambi.wav', 'rb') as audio_file:
            response = self.client.post('/infer', data={'audio': audio_file})
            self.assertEqual(response.status_code, 200)
            self.assertIn(b'generated_text', response.data)

    def test_invalid_audio(self):
        response = self.client.post('/infer', data={'audio': 'invalid_data'})
        self.assertEqual(response.status_code, 400)
        self.assertIn(b'Invalid audio file', response.data)

if __name__ == '__main__':
    unittest.main()