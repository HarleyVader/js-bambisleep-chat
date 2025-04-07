from pydub import AudioSegment
import os

def convert_audio(input_file, output_file, target_format, target_sample_rate=None):
    audio = AudioSegment.from_file(input_file)
    
    if target_sample_rate:
        audio = audio.set_frame_rate(target_sample_rate)
    
    audio.export(output_file, format=target_format)

if __name__ == "__main__":
    input_file = "path/to/input/audio.wav"  # Replace with actual input file path
    output_file = "path/to/output/audio.mp3"  # Replace with desired output file path
    target_format = "mp3"  # Change to desired format (e.g., "wav", "mp3", "ogg")
    target_sample_rate = 24000  # Change to desired sample rate if needed

    convert_audio(input_file, output_file, target_format, target_sample_rate)