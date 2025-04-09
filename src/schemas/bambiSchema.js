import mongoose from 'mongoose';

const bambiSchema = new mongoose.Schema({
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
    about: {
        type: String,
        default: 'Click edit to add your about information'
    },
    description: {
        type: String,
        default: 'Click edit to add your description'
    },
    profilePictureUrl: {
        type: String,
        default: '/default-avatar.gif' // Updated to use the default avatar file
    },
    headerImageUrl: {
        type: String,
        default: '/default-avatar.gif'
    },
    level: {
        type: Number,
        default: 1
    },
    hearts: {
        count: {
            type: Number,
            default: 0
        },
        users: [String] // Store usernames who liked this profile
    },
    followers: [String], // Store usernames of followers
    lastActive: {
        type: Date,
        default: Date.now
    },
    lastViewed: {
        type: Date,
        default: null
    },
    profileTheme: {
        primaryColor: {
            type: String,
            default: null
        },
        textColor: {
            type: String,
            default: null
        }
    },
    triggers: {
        type: [String],
        default: []
    }
});

// Fix the typo in the model name (Bmabi → Bambi)
export const Bambi = mongoose.model('Bambi', bambiSchema);
export default bambiSchema;