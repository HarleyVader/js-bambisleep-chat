import mongoose from 'mongoose';

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

const TriggerSchema = new mongoose.Schema({
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
});

const TriggerHistorySchema = new mongoose.Schema({
  triggerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trigger'
  },
  triggerName: String,
  activatedAt: {
    type: Date,
    default: Date.now
  }
});

const CollarSchema = new mongoose.Schema({
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
});

const SystemControlsSchema = new mongoose.Schema({
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
});

const ProfileSchema = new mongoose.Schema({
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
  triggers: [TriggerSchema],
  triggerHistory: [TriggerHistorySchema],
  activeTriggerSession: {
    startedAt: Date,
    triggersActive: [String],
    lastUpdated: Date
  },
  collar: {
    type: CollarSchema,
    default: () => ({})
  },
  systemControls: {
    type: SystemControlsSchema,
    default: () => ({})
  },
  validConstantsCount: {
    type: Number,
    default: 5
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to add standard triggers if none exist
ProfileSchema.pre('save', function(next) {
  // Add standard triggers if no triggers exist
  if (!this.triggers || this.triggers.length === 0) {
    this.triggers = [
      {
        name: "BAMBI SLEEP",
        description: "The foundational trigger for all bambi dolls",
        active: true,
        isStandard: true
      }
    ];
  }
  
  // Update timestamp
  this.updatedAt = Date.now();
  next();
});

// Static method to get standard triggers
ProfileSchema.statics.getStandardTriggers = function() {
  return STANDARD_TRIGGERS;
};

// Method to add a standard trigger to the profile
ProfileSchema.methods.addStandardTrigger = function(triggerName) {
  if (STANDARD_TRIGGERS.includes(triggerName)) {
    const existingTrigger = this.triggers.find(t => t.name === triggerName);
    
    if (!existingTrigger) {
      this.triggers.push({
        name: triggerName,
        description: `Standard BambiSleep trigger: ${triggerName}`,
        active: true,
        isStandard: true
      });
      return true;
    }
  }
  return false;
};

// Method to toggle all triggers
ProfileSchema.methods.toggleAllTriggers = function(state) {
  const newState = typeof state === 'boolean' ? state : undefined;
  
  this.triggers.forEach(trigger => {
    trigger.active = newState !== undefined ? newState : !trigger.active;
  });
  
  // Update active trigger session
  this.updateActiveTriggerSession();
};

// Get active triggers
ProfileSchema.methods.getActiveTriggers = function() {
  return this.triggers.filter(trigger => trigger.active);
};

// Record trigger activation
ProfileSchema.methods.recordTriggerActivation = function(triggerName) {
  const trigger = this.triggers.find(t => t.name === triggerName);
  
  if (trigger) {
    trigger.lastActivated = new Date();
    trigger.activationCount += 1;
    
    // Add to history (limit to last 100 activations)
    this.triggerHistory.push({
      triggerId: trigger._id,
      triggerName: trigger.name,
      activatedAt: new Date()
    });
    
    // Keep history size manageable
    if (this.triggerHistory.length > 100) {
      this.triggerHistory = this.triggerHistory.slice(-100);
    }
    
    return true;
  }
  
  return false;
};

// Update active trigger session
ProfileSchema.methods.updateActiveTriggerSession = function() {
  const activeTriggers = this.getActiveTriggers();
  const activeTriggerNames = activeTriggers.map(t => t.name);
  
  if (!this.activeTriggerSession || !this.activeTriggerSession.startedAt) {
    this.activeTriggerSession = {
      startedAt: new Date(),
      triggersActive: activeTriggerNames,
      lastUpdated: new Date()
    };
  } else {
    this.activeTriggerSession.triggersActive = activeTriggerNames;
    this.activeTriggerSession.lastUpdated = new Date();
  }
};

// Set trigger active state
ProfileSchema.methods.setTriggerActive = function(triggerName, active) {
  const trigger = this.triggers.find(t => t.name === triggerName);
  
  if (trigger) {
    trigger.active = active;
    
    if (active) {
      this.recordTriggerActivation(triggerName);
    }
    
    this.updateActiveTriggerSession();
    return true;
  }
  
  return false;
};

export default mongoose.model('Profile', ProfileSchema);