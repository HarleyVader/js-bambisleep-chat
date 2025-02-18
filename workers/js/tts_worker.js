import { spawn } from 'child_process';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { colors, patterns } from '../../middleware/bambisleepChalk.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cacheDir = path.join(__dirname, 'a-cache');

try {
    await fsPromises.access(cacheDir);
} catch (error) {
    if (error.code !== 'EEXIST') {
        await fsPromises.mkdir(cacheDir);
    }
}

async function fetchTTS(text, speakerWav, language) {
    console.log(patterns.server.info('Starting TTS fetch...'));
    console.log(patterns.server.info(`Request parameters: text=${text}, speakerWav=${speakerWav}, language=${language}`));

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const pythonPort = process.env.TTS_PORT || 5002;
            const pythonHost = process.env.HOST || '192.168.0.178';
            console.log(patterns.server.info(`Attempt ${attempt + 1}: Sending request to TTS server at http://${pythonHost}:${pythonPort}/api/tts`));
            const response = await axios.post(`http://${pythonHost}:${pythonPort}/api/tts`, {
                text,
                speaker: speakerWav,
                language,
                use_cuda: true
            });

            console.log(patterns.server.info(`Attempt ${attempt + 1}: Received response with status ${response.status}`));
            if (response.status === 200) {
                const ttsFile = response.data.audio_file;
                console.log(patterns.server.success('TTS fetch successful.'));
                return ttsFile;
            } else {
                console.error(patterns.server.error(`Attempt ${attempt + 1}: Failed to fetch TTS audio: ${response.status} - ${response.statusText}`));
                throw new Error('Failed to fetch TTS audio');
            }
        } catch (error) {
            attempt++;
            console.error(patterns.server.error(`[BACKEND ERROR] Attempt ${attempt} - Error fetching TTS audio:`, error.message));
            console.error(patterns.server.error(`[BACKEND ERROR] Full error:`, error));

            if (attempt >= maxRetries) {
                throw new Error('Error fetching TTS audio after multiple attempts');
            }
        }
    }
}

app.get('/api/tts', async (req, res) => {
    const { text, speakerWav, language } = req.query;

    try {
        const ttsFile = await fetchTTS(text, speakerWav, language);
        res.sendFile(ttsFile, (err) => {
            if (err) {
                console.error(patterns.server.error('[BACKEND ERROR] Error sending TTS file:', err.message));
                res.status(500).send('Internal Server Error');
            } else {
                deleteFile(ttsFile).catch((deleteErr) => {
                    console.error(patterns.server.error('[BACKEND ERROR] Error deleting TTS file:', deleteErr.message));
                });
            }
        });
    } catch (error) {
        console.error(patterns.server.error('[BACKEND ERROR] /api/tts route:', error.message));
        res.status(500).json({ error: 'Error fetching TTS audio after multiple attempts' });
    }
});

// Call the function to ensure the cache directory exists
await ensureCacheDir();

async function generateTTS(text, speakerWav, language) {
    const outputFile = path.join(cacheDir, `${speakerWav}_${language}_${text.slice(0, 10)}.wav`);
    const useCuda = true; // Assuming use_cuda is always true

    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [
            path.join(__dirname, '../python/tts.py'),
            text,
            speakerWav,
            language,
            outputFile,
            useCuda.toString()
        ]);

        pythonProcess.stdout.on('data', (data) => {
            console.log(colors.primaryAlt(`[TTS WORKER] stdout: ${data}`));
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(patterns.server.error(`[TTS WORKER ERROR] stderr: ${data}`));
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                console.log(colors.primary(`[TTS WORKER] TTS generation successful, output file: ${outputFile}`));
                resolve(outputFile);
            } else {
                reject(new Error(patterns.server.error(`[TTS WORKER ERROR] TTS generation failed with exit code ${code}`)));
            }
        });
    });
}

async function deleteFile(filePath) {
    try {
        await fs.unlink(filePath);
        console.log(colors.tertiary(`[BACKEND WORKER] File deleted successfully: ${filePath}`));
    } catch (err) {
        console.error(patterns.server.error(`[BACKEND WORKER ERROR] Error deleting file: ${filePath}`), err);
        throw err;
    }
}

export { generateTTS, deleteFile };