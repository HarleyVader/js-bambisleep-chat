import { Bambi } from '../models/Bambi.js';
import logger from '../utils/logger.js';

// Standard trigger list
const standardTriggers = [
  "BIMBO DOLL",
  "GOOD GIRL",
  "BAMBI SLEEP",
  "BAMBI FREEZE",
  "ZAP COCK DRAIN OBEY",
  "BAMBI ALWAYS WINS",
  "BAMBI RESET",
  "I-Q DROP",
  "I-Q LOCK",
  "POSTURE LOCK",
  "UNIFORM LOCK",
  "SAFE & SECURE",
  "PRIMPED",
  "PAMPERED",
  "SNAP & FORGET",
  "GIGGLE TIME",
  "BLONDE MOMENT",
  "BAMBI DOES AS SHE IS TOLD",
  "DROP FOR COCK",
  "COCK ZOMBIE NOW",
  "TITS LOCK",
  "WAIST LOCK",
  "BUTT LOCK",
  "LIMBS LOCK",
  "FACE LOCK",
  "LIPS LOCK",
  "THROAT LOCK",
  "HIPS LOCK",
  "CUNT LOCK",
  "BAMBI CUM & COLAPSE"
];

export const getAllTriggers = async (req, res) => {
  try {
    res.json({ standardTriggers });
  } catch (err) {
    logger.error(`Error getting standard triggers: ${err.message}`);
    res.status(500).json({ error: 'Failed to get standard triggers' });
  }
};

export const getbambiTriggers = async (req, res) => {
  try {
    const { username } = req.params;
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi) {
      return res.status(404).json({ error: 'Bambi not found' });
    }
    
    const activeTriggerSession = bambi.activeTriggerSession || {
      startTime: new Date(),
      activeTriggers: []
    };
    
    res.json({ 
      triggers: bambi.triggers,
      activeTriggerSession
    });
  } catch (err) {
    logger.error(`Error getting bambi triggers: ${err.message}`);
    res.status(500).json({ error: 'Failed to get bambi triggers' });
  }
};

export const addTrigger = async (req, res) => {
  try {
    const { username } = req.params;
    const { name, description, active } = req.body;
    
    if (description && description.length > 1500) {
      return res.status(400).json({ error: 'Description must be 1500 characters or less' });
    }
    
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi) {
      return res.status(404).json({ error: 'Bambi not found' });
    }
    
    const isStandard = standardTriggers.includes(name);
    
    const existingTrigger = bambi.triggers.find(t => t.name === name);
    if (existingTrigger) {
      return res.status(400).json({ error: 'Trigger already exists' });
    }
    
    bambi.triggers.push({
      name,
      description,
      active: active !== false,
      isStandard
    });
    
    if (active !== false) {
      if (!bambi.activeTriggerSession) {
        bambi.activeTriggerSession = {
          startTime: new Date(),
          activeTriggers: [name],
          lastUpdated: new Date()
        };
      } else {
        if (!bambi.activeTriggerSession.activeTriggers) {
          bambi.activeTriggerSession.activeTriggers = [];
        }
        bambi.activeTriggerSession.activeTriggers.push(name);
        bambi.activeTriggerSession.lastUpdated = new Date();
      }
    }
    
    await bambi.save();
    
    res.status(201).json({ 
      message: 'Trigger added successfully',
      trigger: bambi.triggers[bambi.triggers.length - 1],
      activeTriggerSession: bambi.activeTriggerSession
    });
  } catch (err) {
    logger.error(`Error adding trigger: ${err.message}`);
    res.status(500).json({ error: 'Failed to add trigger' });
  }
};

export const toggleTrigger = async (req, res) => {
  try {
    const { username, triggerName } = req.params;
    const { active } = req.body;
    
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi) {
      return res.status(404).json({ error: 'Bambi not found' });
    }
    
    const triggerIndex = bambi.triggers.findIndex(t => t.name === triggerName);
    if (triggerIndex === -1) {
      return res.status(404).json({ error: 'Trigger not found' });
    }
    
    bambi.triggers[triggerIndex].active = active;
    
    if (!bambi.activeTriggerSession) {
      bambi.activeTriggerSession = {
        startTime: new Date(),
        activeTriggers: active ? [triggerName] : [],
        lastUpdated: new Date()
      };
    } else {
      if (!bambi.activeTriggerSession.activeTriggers) {
        bambi.activeTriggerSession.activeTriggers = [];
      }
      
      if (active) {
        if (!bambi.activeTriggerSession.activeTriggers.includes(triggerName)) {
          bambi.activeTriggerSession.activeTriggers.push(triggerName);
        }
      } else {
        bambi.activeTriggerSession.activeTriggers = 
          bambi.activeTriggerSession.activeTriggers.filter(t => t !== triggerName);
      }
      
      bambi.activeTriggerSession.lastUpdated = new Date();
    }
    
    await bambi.save();
    
    res.json({ 
      message: `Trigger ${active ? 'activated' : 'deactivated'} successfully`,
      activeTriggerSession: bambi.activeTriggerSession
    });
  } catch (err) {
    logger.error(`Error toggling trigger: ${err.message}`);
    res.status(500).json({ error: 'Failed to toggle trigger' });
  }
};

export const toggleAllTriggers = async (req, res) => {
  try {
    const { username } = req.params;
    const { active } = req.body;
    
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi) {
      return res.status(404).json({ error: 'Bambi not found' });
    }
    
    bambi.triggers.forEach(trigger => {
      trigger.active = !!active;
    });
    
    if (!bambi.activeTriggerSession) {
      bambi.activeTriggerSession = {
        startTime: new Date(),
        activeTriggers: [],
        lastUpdated: new Date()
      };
    }
    
    if (active) {
      bambi.activeTriggerSession.activeTriggers = bambi.triggers.map(t => t.name);
    } else {
      bambi.activeTriggerSession.activeTriggers = [];
    }
    
    bambi.activeTriggerSession.lastUpdated = new Date();
    
    await bambi.save();
    
    res.json({ 
      message: `All triggers ${active ? 'activated' : 'deactivated'} successfully`,
      activeTriggerSession: bambi.activeTriggerSession,
      triggers: bambi.triggers
    });
  } catch (err) {
    logger.error(`Error toggling all triggers: ${err.message}`);
    res.status(500).json({ error: 'Failed to toggle all triggers' });
  }
};

export const getTriggerHistory = async (req, res) => {
  try {
    const { username } = req.params;
    
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi) {
      return res.status(404).json({ error: 'Bambi not found' });
    }
    
    res.json({ triggerHistory: bambi.triggerHistory || [] });
  } catch (err) {
    logger.error(`Error getting trigger history: ${err.message}`);
    res.status(500).json({ error: 'Failed to get trigger history' });
  }
};

export const processTriggerEvent = async (req, res) => {
  try {
    const { username } = req.params;
    const { triggers } = req.body;
    
    if (!Array.isArray(triggers) || triggers.length === 0) {
      return res.status(400).json({ error: 'No valid triggers provided' });
    }
    
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi) {
      return res.status(404).json({ error: 'Bambi not found' });
    }
    
    if (!bambi.triggerHistory) {
      bambi.triggerHistory = [];
    }
    
    bambi.triggerHistory.push({
      timestamp: new Date(),
      triggers: triggers,
      source: req.body.source || 'web'
    });
    
    if (bambi.triggerHistory.length > 100) {
      bambi.triggerHistory = bambi.triggerHistory.slice(-100);
    }
    
    await bambi.save();
    
    res.status(200).json({ 
      message: 'Trigger event processed successfully',
      triggersProcessed: triggers.length
    });
  } catch (err) {
    logger.error(`Error processing trigger event: ${err.message}`);
    res.status(500).json({ error: 'Failed to process trigger event' });
  }
};