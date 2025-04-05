import axios from 'axios';
import { selectLoadedModels } from '../workers/lmstudio.js';
import { modelCache } from '../../models/modelCache.js';
import { jsonSchemaGenerator } from '../utils/jsonSchemaGenerator.js';

class ProcessingService {
  constructor() {
    this.models = [];
  }

  async loadModels() {
    try {
      const modelNames = [
        'llama-3.2-3b-claude-3.7-sonnet-reasoning-distilled@q4_0',
        'another-model-name' // Replace with the second model name as needed
      ];
      this.models = await Promise.all(modelNames.map(modelName => selectLoadedModels(modelName)));
    } catch (error) {
      console.error('Error loading models:', error);
    }
  }

  async processBambiSleepData(data) {
    try {
      // Analyze and process data related to BambiSleep
      const processedData = this.analyzeData(data);
      
      // Store processed data in cache
      modelCache.store(processedData);

      // Generate JSON schema for the processed data
      const jsonSchema = jsonSchemaGenerator.generate(processedData);
      
      return {
        processedData,
        jsonSchema
      };
    } catch (error) {
      console.error('Error processing BambiSleep data:', error);
      throw error;
    }
  }

  analyzeData(data) {
    // Implement data analysis logic here
    // Clean up information about BambiSleep and create structured outputs
    return cleanedData; // Return the cleaned and structured data
  }
}

export default new ProcessingService();