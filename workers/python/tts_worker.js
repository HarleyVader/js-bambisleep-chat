import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cacheDir = path.join(__dirname, 'a-cache');

// Ensure the cache directory exists
try {
    await fs.access(cacheDir);
} catch (error) {
    console.error(`[TTS WORKER ERROR] Access to cache directory failed: ${error.message}`);
    try {
        await fs.mkdir(cacheDir);
        console.log(`[TTS WORKER] Cache directory created: ${cacheDir}`);
    } catch (mkdirError) {
        console.error(`[TTS WORKER ERROR] Failed to create cache directory: ${mkdirError.message}`);
        // Fallback to a different directory
        cacheDir = path.join(os.tmpdir(), 'tts_cache');
        try {
            await fs.access(cacheDir);
        } catch {
            await fs.mkdir(cacheDir);
        }
        console.log(`[TTS WORKER] Fallback cache directory created: ${cacheDir}`);
    }
}

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
            console.log(`[TTS WORKER] stdout: ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`[TTS WORKER ERROR] stderr: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`[TTS WORKER] TTS generation successful, output file: ${outputFile}`);
                resolve(outputFile);
            } else {
                reject(new Error(`[TTS WORKER ERROR] TTS generation failed with exit code ${code}`));
            }
        });
    });
}

async function deleteFile(filePath) {
    try {
        await fs.unlink(filePath);
        console.log(`[BACKEND WORKER] File deleted successfully: ${filePath}`);
    } catch (err) {
        console.error(`[BACKEND WORKER ERROR] Error deleting file: ${filePath}`, err);
        throw err;
    }
}

export { generateTTS, deleteFile };