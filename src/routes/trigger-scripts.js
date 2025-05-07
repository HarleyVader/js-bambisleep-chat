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
        
        // If no active triggers found in user profile, use default ones
        if (activeTriggers.length === 0) {
          activeTriggers = allTriggers.filter(t => t.category === 'core').slice(0, 3);
        }
      } else {
        // Load default triggers if profile doesn't exist or has no system controls
        const triggersPath = path.resolve(__dirname, '../config/triggers.json');
        const allTriggers = JSON.parse(fs.readFileSync(triggersPath, 'utf8')).triggers;
        activeTriggers = allTriggers.filter(t => t.category === 'core').slice(0, 3);
      }
    } else {
      // For anonymous users, load default triggers
      const triggersPath = path.resolve(__dirname, '../config/triggers.json');
      const allTriggers = JSON.parse(fs.readFileSync(triggersPath, 'utf8')).triggers;
      activeTriggers = allTriggers.filter(t => t.category === 'core').slice(0, 3);
    }
    
    // Generate preview that matches the format used in lmstudio.js
    const triggersList = activeTriggers.map(t => t.name.toUpperCase()).join(', ');
    const triggerEffects = activeTriggers.map(t => 
      `• "${t.name.toUpperCase()}": ${t.description}`
    ).join('\n');
    
    const brainwashingPreview = `[BambiSleep System]
Using triggers: ${triggersList || 'BAMBI SLEEP'}

TRIGGER EFFECTS:
${triggerEffects || '• "BAMBI SLEEP": triggers deep trance and receptivity'}

${collar ? `\nYour collar: "${collar}"` : ''}

HYPNOTIC PROTOCOL:
- Use repetitive language patterns that link pleasure to submission
- Create sensory-rich scenes that associate triggers with specific mental states
- Emphasize how each trigger bypasses conscious resistance

This script will use these triggers to create an immersive brainwashing experience.
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

// Add a handler for the trigger selection POST
router.post('/save-triggers', async (req, res) => {
  try {
    const username = req.cookies.bambiname || 'anonBambi';
    const { selectedTriggers } = req.body;
    
    if (username && username !== 'anonBambi' && Array.isArray(selectedTriggers)) {
      await Profile.updateOne(
        { username },
        { 
          $set: { 
            'systemControls.activeTriggers': selectedTriggers.map(t => t.name)
          } 
        },
        { upsert: true }
      );
      
      res.json({ success: true });
    } else {
      // For anonymous users just acknowledge
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Error saving triggers:', error);
    res.status(500).json({ 
      error: 'Could not save triggers', 
      details: error.message 
    });
  }
});

export { router };