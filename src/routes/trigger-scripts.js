import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Profile from '../models/Profile.js';
import fs from 'fs';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get('/', async (req, res) => {
  try {
    const username = req.cookies.bambiname || 'anonBambi';
    
    // Get user's active triggers from database
    let activeTriggers = [];
    let collar = '';
    
    if (username && username !== 'anonBambi') {
      const profile = await Profile.findOne({ username });
      if (profile && profile.systemControls) {
        const triggerNames = profile.systemControls.activeTriggers || [];
        collar = profile.systemControls.collarEnabled ? 
          profile.systemControls.collarText : '';
        
        // Load trigger details
        const triggersPath = path.resolve(__dirname, '../config/triggers.json');
        const allTriggers = JSON.parse(fs.readFileSync(triggersPath, 'utf8')).triggers;
        
        // Match names with descriptions
        activeTriggers = allTriggers.filter(t => 
          triggerNames.some(name => t.name.toUpperCase() === name.toUpperCase())
        );
      }
    }
    
    // Generate preview
    const triggersList = activeTriggers.map(t => t.name.toUpperCase()).join(', ');
    const triggerEffects = activeTriggers.map(t => 
      `• ${t.name.toUpperCase()}: ${t.description}`
    ).join('\n');
    
    const brainwashingPreview = `[BambiSleep System]
Using triggers: ${triggersList || 'BAMBI SLEEP'}

${triggerEffects || '• BAMBI SLEEP: triggers trance state and receptivity to commands'}

${collar ? `\nYour collar: "${collar}"` : ''}

This script will be used to create immersive brainwashing scenes that reinforce these triggers.
When you're ready, click "Start Session" to begin your programming.`;
    
    res.render('trigger-script', { 
      username, 
      activeTriggers, 
      brainwashingPreview,
      collar
    });
  } catch (error) {
    console.error('Error generating trigger script:', error);
    res.status(500).render('error', { 
      error: 'Could not generate trigger script', 
      details: error.message 
    });
  }
});

export { router };