import { exec } from 'child_process';
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
    const cacheFile = path.join(cacheDir, `${encodeURIComponent(text)}_${speakerWav}_${language}.wav`);

    return new Promise((resolve, reject) => {
        const command = `wsl python3 /mnt/f/js-bambisleep-chat-MK-VIII/python/tts.py "${text}" "${speakerWav}" "${language}" "${cacheFile}"`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`[BACKEND WORKER ERROR] Error generating TTS: ${stderr}`);
                reject(error);
            } else {
                console.log(`[BACKEND WORKER] TTS generated successfully: ${stdout}`);
                resolve(cacheFile);
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