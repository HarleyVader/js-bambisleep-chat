import mongoose from 'mongoose';

const bambiSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    displayName: { type: String },
    profilePictureUrl: { type: String },
    headerImageUrl: { type: String },
    about: { type: String },
    description: { type: String }
});

export const Bambi = mongoose.model('Bambi', bambiSchema);
export default bambiSchema;