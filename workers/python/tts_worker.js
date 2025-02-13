import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { colors, patterns } from '../../middleware/bambisleepChalk.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cacheDir = path.join(__dirname, 'a-cache');

// Ensure the cache directory exists
async function ensureCacheDir() {
    try {
        await fs.access(cacheDir);
    } catch (error) {
        console.error(patterns.server.error(`[TTS WORKER ERROR] Access to a-cache directory failed: ${error.message}`));
        try {
            await fs.mkdir(cacheDir, { recursive: true });
            console.log(colors.primary(`[TTS WORKER] Cache directory created: ${cacheDir}`));
        } catch (mkdirError) {
            console.error(patterns.server.error(`[TTS WORKER ERROR] Failed to create cache directory: ${mkdirError.message}`));
            // Fallback to a different directory
            cacheDir = path.join(os.tmpdir(), 'tts_cache');
            try {
                await fs.access(cacheDir);
            } catch {
                await fs.mkdir(cacheDir, { recursive: true });
            }
            console.log(colors.primary(`[TTS WORKER] Fallback cache directory created: ${cacheDir}`));
        }
    }
}

// Call the function to ensure the cache directory exists
await ensureCacheDir();

async function generateTTS(text, speakerWav, language) {
    const outputFile = path.join(cacheDir, `${speakerWav}_${language}_${text.slice(0, 10)}.wav`);
    const useCuda = true; // Assuming use_cuda is always true

    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [
            path.join(__dirname, 'tts.py'),
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