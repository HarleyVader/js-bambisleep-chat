// Create necessary directories if they don't exist
const audioDir = path.join(__dirname, 'temp', 'audio');
fs.mkdirSync(audioDir, { recursive: true });

/**
 * Generates speech using F5-TTS with voice cloning
 * @param {string} text - Text to convert to speech
 * @param {Buffer|string} refAudio - Reference audio for voice cloning (Buffer or file path)
 * @param {string} refText - Optional transcription of reference audio
 * @returns {Promise<{audioPath: string, error: string|null}>}
 */
async function generateF5TTS(text, refAudio, refText = "") {
  return new Promise(async (resolve, reject) => {
    try {
      const sessionId = uuidv4();
      const refAudioPath = path.join(audioDir, `ref_${sessionId}.wav`);
      const outputPath = path.join(audioDir, `output_${sessionId}.wav`);

      // If refAudio is a Buffer, write it to a file
      if (Buffer.isBuffer(refAudio)) {
        await fsPromises.writeFile(refAudioPath, refAudio);
      } else if (typeof refAudio === 'string') {
        // If it's a path, copy it to our temp location
        await fsPromises.copyFile(refAudio, refAudioPath);
      } else {
        return reject(new Error('Reference audio must be a Buffer or file path'));
      }

      // Prepare arguments for F5-TTS command
      const args = [
        '-m', 'F5TTS_v1_Base',
        '--ref_audio', refAudioPath,
        '--gen_text', text,
        '--output_dir', audioDir,
        '--output_name', `output_${sessionId}`
      ];

      // Add reference text if provided
      if (refText && refText.trim() !== '') {
        args.push('--ref_text', refText);
      }

      // Spawn F5-TTS process
      logger.info(`Generating speech with F5-TTS: ${text}`);
      const f5tts = spawn('f5-tts_infer-cli', args);

      let stderr = '';

      f5tts.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.info(`F5-TTS stderr: ${data}`);
      });

      f5tts.on('close', (code) => {
        if (code !== 0) {
          logger.error(`F5-TTS process exited with code ${code}`);
          logger.error(`Error: ${stderr}`);
          resolve({ audioPath: null, error: stderr || 'Error generating speech' });
        } else {
          logger.success('F5-TTS generation complete');
          resolve({ audioPath: outputPath, error: null });
        }
      });

      f5tts.on('error', (err) => {
        logger.error(`F5-TTS spawn error: ${err.message}`);
        resolve({ audioPath: null, error: err.message });
      });

    } catch (error) {
      logger.error(`Error in generateF5TTS: ${error.message}`);
      resolve({ audioPath: null, error: error.message });
    }
  });
}

// API endpoint for F5-TTS voice cloning
app.post('/api/f5tts', async (req, res) => {
  try {
    // Check if we have the required fields
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'Invalid input: text must be a non-empty string' });
    }

    // Check if reference audio was uploaded
    if (!req.files || !req.files.refAudio) {
      return res.status(400).json({ error: 'Reference audio file is required' });
    }

    const refAudio = req.files.refAudio.data;
    const refText = req.body.refText || '';

    const { audioPath, error } = await generateF5TTS(text, refAudio, refText);

    if (error || !audioPath) {
      return res.status(500).json({ error: error || 'Failed to generate speech' });
    }

    // Send the audio file
    res.sendFile(audioPath, (err) => {
      if (err) {
        logger.error(`Error sending file: ${err}`);
        res.status(500).json({ error: 'Error sending audio file' });
      }

      // Clean up temporary files after sending
      fs.unlink(audioPath, (unlinkErr) => {
        if (unlinkErr) logger.error(`Error deleting file: ${unlinkErr}`);
      });
    });

  } catch (error) {
    logger.error(`Error in /api/f5tts: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});


async function fetchTTS(text) {
  try {
    const response = await axios.get(`http://${process.env.SPEECH_HOST}:${process.env.SPEECH_PORT}/api/tts`, {
      params: { text },
      responseType: 'arraybuffer',
    });
    return response;
  } catch (error) {
    logger.error('Error fetching TTS audio:', error);
    throw error;
  }
}

app.use('/api/tts', async (req, res, next) => {
  const text = req.query.text;
  if (typeof text !== 'string' || text.trim() === '') {
    return res.status(400).send('Invalid input: text must be a non-empty string');
  } else {
    try {
      const response = await fetchTTS(text);
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', response.data.length);
      res.send(response.data);
    } catch (error) {
      logger.error('Error fetching TTS audio:', error);
      if (error.response) {
        if (error.response.status === 401) {
          logger.error('Unauthorized access - invalid token');
          res.status(401).send('Unauthorized access');
        } else {
          logger.error('Error details:', error.response.data.toString());
          res.status(500).send('Error fetching TTS audio');
        }
      } else {
        logger.error('Error details:', error.message);
        res.status(500).send('Error fetching TTS audio');
      }
      next();
    }
  }
});