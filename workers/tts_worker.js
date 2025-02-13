const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cacheDir = path.join(__dirname, 'cache');

// Ensure the cache directory exists
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
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
    return new Promise((resolve, reject) => {
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error(`[BACKEND WORKER ERROR] Error deleting file: ${filePath}`, err);
                reject(err);
            } else {
                console.log(`[BACKEND WORKER] File deleted successfully: ${filePath}`);
                resolve();
            }
        });
    });
}

module.exports = { generateTTS, deleteFile };