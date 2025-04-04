import axios from 'axios';
import { selectLoadedModels } from '../workers/lmstudio.js';
import { modelCache } from '../models/modelCache.js';

class InferenceService {
  constructor() {
    this.models = [];
  }

  async loadModels() {
    try {
      const modelNames = [
        'llama-3.2-3b-claude-3.7-sonnet-reasoning-distilled@q4_0',
        'another-model-name' // Replace with the actual second model name
      ];
      this.models = await Promise.all(modelNames.map(modelName => selectLoadedModels(modelName)));
    } catch (error) {
      console.error('Error loading models:', error);
    }
  }

  async analyzeBambiSleepData(data) {
    const structuredOutputs = [];

    for (const modelId of this.models) {
      const response = await this.makeInference(modelId, data);
      const cleanedData = this.cleanBambiSleepData(response.data);
      const jsonSchema = this.generateJsonSchema(cleanedData);
      structuredOutputs.push(jsonSchema);
    }

    return structuredOutputs;
  }

  async makeInference(modelId, data) {
    try {
      const response = await axios.post(`http://${process.env.LMS_HOST}:${process.env.LMS_PORT}/v1/infer`, {
        model: modelId,
        data: data
      });
      return response;
    } catch (error) {
      console.error('Error making inference:', error);
      throw error;
    }
  }

  cleanBambiSleepData(data) {
    // Implement logic to clean up BambiSleep data
    return data; // Return cleaned data
  }

  generateJsonSchema(data) {
    // Implement logic to generate JSON schema from data
    return {}; // Return generated JSON schema
  }
}

export default new InferenceService();