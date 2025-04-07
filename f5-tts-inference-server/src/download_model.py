import os
import requests
import tarfile

def download_model(model_url, model_dir):
    if not os.path.exists(model_dir):
        os.makedirs(model_dir)

    model_file = os.path.join(model_dir, "f5-tts-small-model.tar.gz")

    if not os.path.exists(model_file):
        print(f"Downloading model from {model_url}...")
        response = requests.get(model_url, stream=True)
        if response.status_code == 200:
            with open(model_file, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print("Download complete.")
        else:
            print(f"Failed to download model: {response.status_code}")
            return

    print("Extracting model...")
    with tarfile.open(model_file, 'r:gz') as tar:
        tar.extractall(path=model_dir)
    print("Model extracted.")

if __name__ == "__main__":
    MODEL_URL = "https://github.com/SWivid/F5-TTS/releases/download/v1.0/f5-tts-small-model.tar.gz"
    MODEL_DIR = "./models"

    download_model(MODEL_URL, MODEL_DIR)