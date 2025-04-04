import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class ModelManager {
  constructor() {
    this.models = {};
  }

  async loadModels() {
    try {
      const modelNames = [
        'llama-3.2-3b-claude-3.7-sonnet-reasoning-distilled@q4_0',
        'another-model-name' // Replace with the second model name as needed
      ];

      for (const modelName of modelNames) {
        const modelId = await this.selectLoadedModels(modelName);
        if (modelId) {
          this.models[modelName] = modelId;
        } else {
          console.warn(`Model ${modelName} could not be loaded.`);
        }
      }
    } catch (error) {
      console.error('Error loading models:', error);
    }
  }

  async selectLoadedModels(modelName) {
    const response = await axios.get(`http://${process.env.LMS_HOST}:${process.env.LMS_PORT}/v1/models`);
    const models = response.data.data;
    const selectedModel = models.find(model => model.id.toLowerCase().includes(modelName.toLowerCase()));
    return selectedModel ? selectedModel.id : null;
  }

  getModel(modelName) {
    return this.models[modelName] || null;
  }
}

export default new ModelManager();