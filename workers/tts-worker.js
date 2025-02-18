import { parentPort } from 'worker_threads';
import path from 'path';

parentPort.on('message', (message) => {
  const { text, speaker_wav, language, output_file, use_cuda } = message;
  const ttsScriptPath = path.resolve(__dirname, '../../py-tts-server/src/tts/tts.py');
  
  const command = `python ${ttsScriptPath} "${text}" "${speaker_wav}" "${language}" "${output_file}" ${use_cuda}`;
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      parentPort.postMessage({ error: stderr });
    } else {
      parentPort.postMessage({ success: stdout });
    }
  });
});
