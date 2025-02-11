import express from 'express';
import { UltravoxService } from '../workers/ultravox.js';
import config from '../ultravox.config.js';

const router = express.Router();

router.get('/', (req, res) => {
    res.render('ultravox', { 
        title: 'Ultravox Speech Interface',
        websocketUrl: config.websocketUrl,
        sdkVersion: config.sdkVersion
    });
});

router.post('/synthesize', async (req, res) => {
    try {
        const audio = await UltravoxService.synthesizeSpeech(req.body.text);
        res.json({ success: true, audio });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
