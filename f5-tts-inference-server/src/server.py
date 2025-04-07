from flask import Flask, request, jsonify
import os
import subprocess
from inference import perform_inference
from config import load_server_config

app = Flask(__name__)

# Load server configuration
server_config = load_server_config()

@app.route('/infer', methods=['POST'])
def infer():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    audio_file = request.files['audio']
    audio_path = os.path.join('data/reference_audio', audio_file.filename)
    audio_file.save(audio_path)

    try:
        # Perform inference using the provided audio file
        result = perform_inference(audio_path)
        return jsonify({'result': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host=server_config['host'], port=server_config['port'], debug=True)