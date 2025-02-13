import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

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
    try {
        const pythonPort = process.env.PYTHON_PORT || 5002;
        const pythonHost = process.env.PYTHON_HOST || '192.168.0.178';
        const response = await fetch(`http://${pythonHost}:${pythonPort}/generate-tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, speaker: speakerWav, language })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }

        const data = await response.json();
        return data.audio_file;
    } catch (error) {
        console.error(`[BACKEND WORKER ERROR] Error generating TTS: ${error.message}`);
        throw error;
    }
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