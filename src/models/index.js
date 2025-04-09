import mongoose from 'mongoose';
import { BambiSchema } from './Bambi.js';

// Register all models in one place
export function registerModels() {
  if (!mongoose.models.Bambi) {
    mongoose.model('Bambi', BambiSchema);
  }
  
  // Register other models here
}

// Export models for use in other files
export const Bambi = mongoose.model('Bambi');