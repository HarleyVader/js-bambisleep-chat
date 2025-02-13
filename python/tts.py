import sys
import os
import logging
from dotenv import load_dotenv
from TTS.api import TTS

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

        # Initialize TTS
        tts = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC", progress_bar=False, gpu=False)

        # Synthesize speech
        tts.tts_to_file(text=text, speaker_wav=speaker_wav, file_path=output_file)
        print("TTS synthesis completed successfully.")
    except Exception as e:
        logging.error("[BACKEND ERROR] Error during TTS synthesis", exc_info=True)
        logging.error(f"Text: {text}")
        logging.error(f"Speaker WAV: {speaker_wav}")
        logging.error(f"Language: {language}")
        logging.error(f"Output File: {output_file}")
        logging.error(f"Exception: {e}")
        logging.error("Exception type: %s", type(e))
        logging.error("Exception args: %s", e.args)
        exit(1)

if __name__ == "__main__":
    logging.basicConfig(level=logging.ERROR)
    main()
