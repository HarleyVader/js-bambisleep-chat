// filepath: lm-studio-project/src/models/modelCache.js
class ModelCache {
  constructor() {
    this.cache = new Map();
  }

  // Store model data in the cache
  setModelData(modelId, data) {
    this.cache.set(modelId, data);
  }

  // Retrieve model data from the cache
  getModelData(modelId) {
    return this.cache.get(modelId);
  }

  // Check if model data exists in the cache
  hasModelData(modelId) {
    return this.cache.has(modelId);
  }

  // Clear the cache
  clearCache() {
    this.cache.clear();
  }
}

// Exporting the singleton instance of ModelCache
const modelCache = new ModelCache();
export default modelCache;