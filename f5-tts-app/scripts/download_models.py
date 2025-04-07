import os
import requests

def download_file(url, destination):
    response = requests.get(url)
    response.raise_for_status()  # Raise an error for bad responses
    with open(destination, 'wb') as f:
        f.write(response.content)

def main():
    model_urls = {
        "F5TTS_Small": "https://huggingface.co/SWivid/F5-TTS/F5TTS_Small/model_latest.safetensors",
        "F5TTS_Base": "https://huggingface.co/SWivid/F5-TTS/F5TTS_Base/model_1200000.safetensors",
        "vocab_small": "https://huggingface.co/SWivid/F5-TTS/F5TTS_Small/vocab.txt",
        "vocab_base": "https://huggingface.co/SWivid/F5-TTS/F5TTS_Base/vocab.txt"
    }

    os.makedirs('src/models', exist_ok=True)

    for name, url in model_urls.items():
        destination = os.path.join('src/models', os.path.basename(url))
        print(f"Downloading {name} from {url} to {destination}...")
        download_file(url, destination)
        print(f"Downloaded {name} successfully.")

if __name__ == "__main__":
    main()