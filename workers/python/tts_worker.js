import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cacheDir = path.join(__dirname, 'cache');

// Ensure the cache directory exists
try {
    await fs.access(cacheDir);
} catch {
    await fs.mkdir(cacheDir);
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