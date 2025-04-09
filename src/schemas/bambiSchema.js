import mongoose from 'mongoose';

const bambiSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    displayName: { type: String },
    profilePictureUrl: { type: String, default: '/bambis/default-avatar.gif' },
    headerImageUrl: { type: String, default: '/bambis/default-header.jpg' },
    about: { type: String, default: 'A mysterious Bambi...' },
    description: { type: String, default: 'This Bambi has not shared much about themselves yet.' },
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
    followers: { type: [String], default: [] },
    following: { type: [String], default: [] },
    hearts: { 
        count: { type: Number, default: 0 },
        users: { 
            type: [{ 
                username: String, 
                timestamp: { type: Date, default: Date.now }
            }], 
            default: []
        }
    },
    profileTheme: {
        primaryColor: { type: String, default: 'var(--transparent)' },
        secondaryColor: { type: String, default: 'var(--button-color)' },
        textColor: { type: String, default: 'var(--primary-alt)' }
    },
    triggers: { type: [String], default: [] },
    woodland: { type: String, default: 'Sleepy Meadow' },
    favoriteSeasons: { type: [String], default: ['spring'] },
    lastActive: { type: Date, default: Date.now },
    lastViewed: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

// Add a method to add experience
bambiSchema.methods.addExperience = async function(amount) {
    this.experience += amount;
    
    // Check if we should level up (simple formula: level^2 * 10)
    const nextLevelThreshold = this.level * this.level * 10;
    if (this.experience >= nextLevelThreshold) {
        this.level += 1;
        return true; // Return true if leveled up
    }
    return false; // No level up
};

// Add a method to add activity
bambiSchema.methods.addActivity = async function(type, description) {
    if (!this.activities) {
        this.activities = [];
    }
    
    this.activities.unshift({
        type,
        description,
        timestamp: Date.now()
    });
    
    // Keep only the last 20 activities
    if (this.activities.length > 20) {
        this.activities = this.activities.slice(0, 20);
    }
};

// Helper to check if a user has liked this profile
bambiSchema.methods.isLikedBy = function(username) {
    return this.hearts.users.some(user => user.username === username);
};

export const Bambi = mongoose.model('Bambi', bambiSchema);
export default bambiSchema;