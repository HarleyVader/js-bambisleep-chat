import sys
import requests
from dotenv import load_dotenv
import os

def main():
    if len(sys.argv) < 5:
        print("Usage: python tts.py <text> <speaker_wav> <language> <output_file>")
        return

    text = sys.argv[1]
    speaker_wav = sys.argv[2]
    language = sys.argv[3]
    output_file = sys.argv[4]

    print(f"Text: {text}")
    print(f"Speaker WAV: {speaker_wav}")
    print(f"Language: {language}")
    print(f"Output File: {output_file}")

    try:
        # Load environment variables from .env file
        load_dotenv(dotenv_path='/f:/js-bambisleep-chat-MK-VIII/.env')

        # Fetch the port from the .env file
        port = os.getenv('LMS_PORT', '5000')

        # Connect to the remote host for TTS processing
        remote_host = f"http://192.168.0.178:{port}/tts"
        response = requests.post(remote_host, json={
            "text": text,
            "speaker_wav": speaker_wav,
            "language": language
        })

        if response.status_code == 200:
            with open(output_file, 'wb') as f:
                f.write(response.content)
            print("TTS synthesis completed successfully.")
        else:
            print(f"Error during TTS synthesis: {response.text}")
            exit(1)
    except Exception as e:
        print(f"Error during TTS synthesis: {e}")
        exit(1)

if __name__ == "__main__":
    main()
