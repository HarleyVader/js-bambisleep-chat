import mongoose from 'mongoose';
import { getModel } from '../config/db.js';

// Standard BambiSleep triggers from triggers.js
const STANDARD_TRIGGERS = [
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

// Define schema
const profileSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    trim: true
  },
  avatar: {
    type: String,
    default: '/gif/default-avatar.gif'
  },
  headerImage: {
    type: String,
    default: '/gif/default-header.gif'
  },
  headerColor: {
    type: String,
    default: '#35424a'
  },
  about: {
    type: String,
    default: 'Tell us about yourself...',
    maxlength: 150
  },
  description: {
    type: String,
    default: 'Share your bambi journey...',
    maxlength: 1500
  },
  triggers: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: String,
    active: {
      type: Boolean,
      default: true
    },
    isStandard: {
      type: Boolean,
      default: false
    },
    lastActivated: {
      type: Date,
      default: null
    },
    activationCount: {
      type: Number,
      default: 0
    }
  }],
  activeTriggerSession: {
    startTime: Date,
    lastUpdated: Date,
    activeTriggers: [String]
  },
  triggerHistory: [{
    timestamp: Date,
    triggers: [String],
    source: String
  }],
  collar: {
    text: {
      type: String,
      default: ''
    },
    enabled: {
      type: Boolean,
      default: false
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  systemControls: {
    spiralsEnabled: {
      type: Boolean,
      default: false
    },
    hypnosisEnabled: {
      type: Boolean,
      default: false
    },
    multiplierSettings: {
      A1: { type: Number, default: 1 },
      A2: { type: Number, default: 1 },
      B1: { type: Number, default: 1 },
      B2: { type: Number, default: 1 },
      operation: { 
        type: String, 
        enum: ['add', 'subtract', 'multiply', 'divide'],
        default: 'add'
      }
    }
  },
  validConstantsCount: {
    type: Number,
    default: 5
  }
}, { 
  timestamps: true 
});

// Add methods for trigger functionality
profileSchema.methods.toggleTrigger = function(triggerName, active) {
  const trigger = this.triggers.find(t => t.name === triggerName);
  
  if (trigger) {
    trigger.active = active;
    
    if (active) {
      trigger.lastActivated = new Date();
      trigger.activationCount += 1;
      
      if (!this.triggerHistory) {
        this.triggerHistory = [];
      }
      
      this.triggerHistory.push({
        timestamp: new Date(),
        triggers: [triggerName],
        source: 'toggleTrigger'
      });
      
      if (this.triggerHistory.length > 100) {
        this.triggerHistory = this.triggerHistory.slice(-100);
      }
    }
    
    this.updateActiveTriggerSession();
    return true;
  }
  
  return false;
};

profileSchema.methods.toggleAllTriggers = function(active) {
  this.triggers.forEach(trigger => {
    trigger.active = active;
    
    if (active) {
      trigger.lastActivated = new Date();
      trigger.activationCount += 1;
    }
  });
  
  this.updateActiveTriggerSession();
  
  if (active && this.triggers.length > 0) {
    if (!this.triggerHistory) {
      this.triggerHistory = [];
    }
    
    this.triggerHistory.push({
      timestamp: new Date(),
      triggers: this.triggers.map(t => t.name),
      source: 'toggleAllTriggers'
    });
    
    if (this.triggerHistory.length > 100) {
      this.triggerHistory = this.triggerHistory.slice(-100);
    }
  }
};

profileSchema.methods.setTriggerActive = function(triggerName, active) {
  return this.toggleTrigger(triggerName, active);
};

profileSchema.methods.updateActiveTriggerSession = function() {
  const activeTriggers = this.triggers.filter(trigger => trigger.active).map(t => t.name);
  
  if (!this.activeTriggerSession || !this.activeTriggerSession.startTime) {
    this.activeTriggerSession = {
      startTime: new Date(),
      activeTriggers: activeTriggers,
      lastUpdated: new Date()
    };
  } else {
    this.activeTriggerSession.activeTriggers = activeTriggers;
    this.activeTriggerSession.lastUpdated = new Date();
  }
};

// Register the model directly instead of using registerModel
mongoose.model('Profile', profileSchema, 'profiles');

// Get model function that will work after initialization
export const getProfile = () => {
  return mongoose.model('Profile');
};

export { STANDARD_TRIGGERS };